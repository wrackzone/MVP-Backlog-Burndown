Ext.define("Rally.SolutionsArchitect.TimeSeriesCalculator", {
    extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",

    config: {
        /*
         * Required
         */
        group_by_field: null,
        /*
         * Name of field that holds the value to add up
         * (Required if type is "sum")
         */
        value_field: null, 
        /*
         * allowed_values (Required): array of available values in field to group by
         */
         allowed_values: null,
         /*
          * allowed_oids is an array of ObjectIDs that are allowed to be reported on
          * This lets you restrict to a set of items that currently met a WSAPI filter 
          * (e.g., if I want to apply a tag to stories and then see what those stories' histories
          * have been. If I put tag in the lookback query, then that tag has to have been assigned
          * yesterday to see what happened to the items yesterday)
          * 
          * leave as null to allow everything
          */
         allowed_oids: null,
         granularity: 'day',
         /*
          * value_type: 'sum' | 'count' whether to count on given field or to count the records
          */
         value_type: 'sum',
         endDate: null,
         startDate: null,
         workDays: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday'.split(), //# They work on Sundays
         useMVP : false,
         mvpField : "",
         mvpValue : "",
         lastState : null
    },
    constructor: function (config) {
        this.callParent(arguments);
        this._prepareDates();
    },
    /*
     * The goal is to have two dates, in order, that are ISO strings
     */
    _prepareDates: function() {
        if ( this.startDate === "" ) { this.startDate = null; }
        if ( this.endDate === "" )   { this.endDate   = null; }
        
        if ( this.startDate && typeof(this.startDate) === 'object' ) {
            this.startDate = Rally.util.DateTime.toIsoString(this.startDate);
        }
        if ( this.endDate && typeof(this.endDate) === 'object' ) {
            this.endDate = Rally.util.DateTime.toIsoString(this.endDate);
        }
        
        if ( this.startDate && ! /-/.test(this.startDate)  ){
            throw "Failed to create Rally.TechnicalServices.CFDCalculator: startDate must be a javascript date or ISO date string";
        }

        if ( this.endDate && ! /-/.test(this.endDate)  ){
            throw "Failed to create Rally.TechnicalServices.CFDCalculator: endDate must be a javascript date or ISO date string";
        }
    
        // switch dates
        if ( this.startDate && this.endDate ) {
            if ( this.startDate > this.endDate ) {
                var holder = this.startDate;
                this.startDate = this.endDate;
                this.endDate = holder;
            }
        }
        
        if ( this.startDate ) { this.startDate = this.startDate.replace(/T.*$/,""); }
        if ( this.endDate ) { this.endDate = this.endDate.replace(/T.*$/,""); }
    },

    getDerivedFieldsOnInput : function() {

      var that = this;

      var accepted = function(state) {
        return state === "Accepted" || state === that.lastState;
      }

      var isMVP = function(snapshot) {
        return snapshot[that.mvpField] === that.mvpValue;
      }

      return [
        { 
          "as": "MVP",
          "f": function(snapshot) { 
            return ( that.useMVP===true ? ( isMVP(snapshot) ? snapshot.PlanEstimate : 0) : 0);
          }
        },
        { 
          "as": "Non-MVP",
          "f": function(snapshot) { 
            return ( that.useMVP===true ? ( !isMVP(snapshot) ? snapshot.PlanEstimate : 0) : 0);
          }
        },
        { 
          "as": "ToDo",
          "f": function(snapshot) { 
            return ( !accepted(snapshot.ScheduleState) ) ? snapshot.PlanEstimate : 0 ;
          }
        },
        { 
          "as": "Completed",
          "f": function(snapshot) { 
            // console.log("snapshot:",snapshot,snapshot.ScheduleState)
            return ( accepted(snapshot.ScheduleState) ) ? 
              snapshot.PlanEstimate * -1 : 0 ;
          }
        }
      ];
    },
    /*
     * How to measure
     * 
     * { 
     *      field       : the field that has the value to add up on each day
     *      as          : the name to display in the legend
     *      display     : "line" | "column" | "area"
     *      f           : function to use (e.g., "sum", "filteredSum"
     *      filterField : (when f=filteredSum) field with values used to group by (stacks on column)
     *      filterValues: (when f=filteredSum) used to decide which values of filterField to show
     */
    getMetrics: function () {

      return [
        {
          as : 'ToDo',
          field : 'ToDo',
          f : 'sum',
          display : 'column'
        },
        {
          as : 'Completed',
          field : 'Completed',
          f : 'sum',
          display : 'column'
        },
        {
          as : 'MVP',
          field : 'MVP',
          f : 'sum',
          display : 'column'
        },
        {
          as : 'Non-MVP',
          field : 'Non-MVP',
          f : 'sum',
          display : 'column'
        }
      ];
    },

    // override runCalculation to change false to "false" because highcharts doesn't like it
    runCalculation: function (snapshots) {

      // console.log("snapshots",snapshots);
      // console.log(_.uniq(_.map(snapshots,function(s){return s.FormattedID})));
        
        var calculatorConfig = this._prepareCalculatorConfig(),
            seriesConfig = this._buildSeriesConfig(calculatorConfig);

        var calculator = this.prepareCalculator(calculatorConfig);
        
        var clean_snapshots = this._convertNullToBlank(snapshots);
        if (this.allowed_oids !== null) {
            clean_snapshots = this._getAllowedSnapshots(clean_snapshots);
        }
        if ( clean_snapshots.length > 0 ) {
            calculator.addSnapshots(clean_snapshots, this._getStartDate(clean_snapshots), this._getEndDate(clean_snapshots));
        }
        var chart_data = this._transformLumenizeDataToHighchartsSeries(calculator, seriesConfig);
        
        // check for false
        Ext.Array.each(chart_data.series,function(series){
            if ( series.name === "" ) {
                series.name = "None";
            }
            
            if (series.name === false) {
                series.name = "False";
            }
            
            if (series.name === true) {
                series.name = "True";
            }
        });
        
        return chart_data;
    },
    _convertNullToBlank:function(snapshots){
        var number_of_snapshots = snapshots.length;
        for ( var i=0;i<number_of_snapshots;i++ ) {
            if ( snapshots[i][this.group_by_field] === null ) {
                snapshots[i][this.group_by_field] = "";
            }
        }
        return snapshots;
    }


        
        
});
