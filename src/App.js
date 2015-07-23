Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',
	items : [
		{xtype:'container',itemId:'display_box',margin:10}
	],
	maxMonths : 6,
	additionalFields : "c_Priority".split(),
	mvpExpression : "snapshot.c_Priority === 'MVP'",
	launch: function() {
		var me = this;
		// read all iterations
		// read all story snapshots
		// create calculator and metrics based on total backlog, mvp stories and accepted stories
		// chart it.
		Deft.Promise.all([
			me.getIterations(),
			me.getSnapshots(),
			me.getLastState()
		],me).then({
			success : function(results) {
				console.log("results",results);
				var chartData = me.prepareChartData(results[0],results[1],results[2]);
				console.log("chartData",chartData);

				if (!_.isUndefined(me.chart)) {
					me.remove(that.chart);
				}
				me.chart = Ext.create('Rally.SolutionArchitect.Chart', {
					itemId: 'rally-chart',
					chartData: chartData
				});
				me.add(me.chart);
			},
			failure : function(error) {
				console.log("error---",error);
			}
		});
	},

	prepareChartData : function( iterations, snapshots, lastState ) {
		var me = this;

		var dateRange = me.getDateRange( iterations );
		var calculator = Ext.create('Rally.SolutionsArchitect.TimeSeriesCalculator',{
			startDate : dateRange.start,
			endDate : dateRange.end,
			mvpExpression : me.mvpExpression,
			lastState : lastState
		});
		var data = calculator.runCalculation(_.map(snapshots,function(s){return s.data;}));
		// console.log("data",data);

		var series = _.map(["MVP","Non-MVP","Completed"],function(s) {
			var sdata = _.find(data.series,function(sr) { return sr.name === s});
			var today = moment();
			// console.log("sdata",sdata);
			return {
				name : s,
				type : 'column',
				data : _.map(iterations,function(i) { 
					// 0: "2014-11-03"
					var endDate = "" + moment(i.raw.EndDate).format("YYYY-MM-DD");
					var x = _.findIndex(data.categories,function(c) { return c == endDate });
					if (moment(i.raw.EndDate)>today) 
						return null;
					else
						return sdata.data[x];
				})
			}
		});

		var categories = _.map(iterations,function(i) { 
			return i.get("Name") + " [" + 
				moment(i.raw.EndDate).format("MMM DD")
			+  "]";
		});

		return { series : series, categories : categories };
	},

	getDateRange : function(iterations) {
		var start = _.min( iterations, function(iteration){return moment(iteration.get("StartDate"))});
		var end   = _.max( iterations, function(iteration){return moment(iteration.get("EndDate"))});
		// console.log("start",start,"end",end);
		return { start: start.raw.StartDate, end : end.raw.EndDate};
	},

	getLastState : function() {

		var me = this;
		var deferred = Ext.create('Deft.Deferred');
		Rally.data.ModelFactory.getModel({
		    type: 'UserStory',
		    success: function(model) {
		        model.getField('ScheduleState').getAllowedValueStore().load({
		            callback: function(records, operation, success) {
		            	console.log(records);
		            	var lastState = _.last(records).get("StringValue");
		            	console.log("lastState",lastState);
		        		deferred.resolve(lastState)
		            }
		        });
		    }
		});
		return deferred.promise;
	},

	getIterations : function() {
		var me = this;
		var deferred = Ext.create('Deft.Deferred');
		var filter = Ext.create('Rally.data.wsapi.Filter', {
            property : 'StartDate', operator : '>=', value : moment().subtract(me.maxMonths,"months").toISOString()
        });
        filter = filter.and(
			Ext.create('Rally.data.wsapi.Filter', {
            	property : 'StartDate', operator : '<=', value : moment().add(me.maxMonths,"months").toISOString()
        	})
        );
		me._loadAStoreWithAPromise(
			"Iteration", 
			["Name","EndDate","StartDate"], 
			[filter],
			{
				projectScopeDown : false,
				projectScopeUp : false
			}
		).then({
			scope: me,
			success: function(values) {
				// sort the iterations by start date
				values = _.sortBy(values,function(value) { return moment(value.raw.StartDate);});
				deferred.resolve(values);
			},
			failure: function(error) {
				deferred.resolve([]);
			}
		});
		return deferred.promise;
	},

	getSnapshots : function() {
		var me = this;
		var deferred = Ext.create('Deft.Deferred');
		// me.showMask("Loading snapshots...");
		// find,fetch,hydrate,ctx
		me._loadASnapShotStoreWithAPromise(
			{
				_TypeHierarchy : { "$in" : ["HierarchicalRequirement"] },
				_ProjectHierarchy : { "$in" : [me.getContext().getProject().ObjectID]},
				"$or" : [
					{_ValidFrom : { "$gt" : (moment().subtract(me.maxMonths,"months")).toISOString() }},
					{"__At": "current"}
				],
				Children : null
			}, 
			["_TypeHierarchy","ObjectID","FormattedID","PlanEstimate","ScheduleState"].concat(me.additionalFields), 
			["_TypeHierarchy","ScheduleState"],
			null
		).then({
			scope: me,
			success: function(values) {
				// me.hideMask();
				deferred.resolve(values);
			},
			failure: function(error) {
				console.log("error",error);
				deferred.resolve([]);
			}
		});
		return deferred.promise;
	},

	_loadAStoreWithAPromise: function(model_name, model_fields, filters,ctx,order) {
		var deferred = Ext.create('Deft.Deferred');
		var me = this;
		  
		var config = {
			model: model_name,
			fetch: model_fields,
			filters: filters,
			limit: 'Infinity'
		};
		if (!_.isUndefined(ctx)&&!_.isNull(ctx)) {
			config.context = ctx;
		}
		if (!_.isUndefined(order)&&!_.isNull(order)) {
			config.order = order;
		}

		Ext.create('Rally.data.wsapi.Store', config ).load({
			callback : function(records, operation, successful) {
				if (successful){
					deferred.resolve(records);
				} else {
					deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
				}
			}
		});
		return deferred.promise;
	},

	_loadASnapShotStoreWithAPromise: function(find, fetch, hydrate, ctx) {
		var me = this;
		var deferred = Ext.create('Deft.Deferred');
		  
		var config = {
			find : find,
			fetch: fetch,
			hydrate : hydrate,
			pageSize : 10000,
			limit: 'Infinity'
		};

		if (!_.isUndefined(ctx)) { config.context = ctx;}

		var storeConfig = Ext.merge(config, {
			removeUnauthorizedSnapshots : true,
			autoLoad : true,
			listeners: {
			   load: function(store, data, success) {
					deferred.resolve(data);
				}
			},
		});
		console.log("storeConfig",storeConfig);
		Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);
		return deferred.promise;
	},
    showMask: function(msg) {
        if ( this.getEl() ) { 
            this.getEl().unmask();
            this.getEl().mask(msg);
        }
    },
    hideMask: function() {
        this.getEl().unmask();
    },


});
