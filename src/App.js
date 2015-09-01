var app = null;

Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',
	items : [
		{xtype:'container',itemId:'display_box',margin:10}
	],
	maxMonths : 6,
	launch: function() {
		var me = this;
		app = this;
		me.useMVP   = me.getSetting("usemvp")===true || me.getSetting("usemvp")==="true" ;
		me.mvpField = me.getSetting("mvpfield");
		me.mvpValue = me.getSetting("mvpvalue");
		me.maxMonths = parseInt(me.getSetting("maxMonths"));

		console.log(me.useMVP,me.mvpField,me.mvpValue);

		// read all iterations
		// read all story snapshots
		// create calculator and metrics based on total backlog, mvp stories and accepted stories
		// chart it.
		// Deft.Promise.all([
			Deft.Chain.pipeline([
			me.getLastState,
			me.getIterations,
			me.getSnapshots
		],me).then({
			success : function(results) {
				me.hideMask();

				var accepted = function(state) {
        			return state === "Accepted" || state === me.lastState;
      			}

      			var isMVP = function(snapshot) {
      				return snapshot.get(me.mvpField) === me.mvpValue;
      			}

				// for each set of results
				// 	group by object
				//  sort group by valid from date
				//  take the last value
				//	reduce the last values by category.
				var seriesData = _.map(results,function(result,i){
					var snapsByID = _.groupBy(result,function(snapshot){return snapshot.get("ObjectID");});

					var snapshots = _.map(_.keys(snapsByID),function(id) {
						return _.last(
							_.sortBy(snapsByID[id],function(s){ return moment(s.get("_ValidFrom"))})
						);
					});

					// console.log("snapshots",_.map(snapshots,function(s){return s.get("FormattedID")+":"+s.get("PlanEstimate")}));
					// console.log("snapshots",_.map(
					// 	_.filter(snapshots,function(s){return !accepted(s.get("ScheduleState"))}),
					// 		function(s){return s.get("FormattedID")+":"+s.get("ScheduleState")+":"+s.get("PlanEstimate")}
					// 	)
					// );

					var completedPoints = _.reduce(snapshots,
						function(memo,snapshot){
							return memo + (accepted(snapshot.get("ScheduleState")) ? snapshot.get("PlanEstimate") : 0);
					},0);
					var todoPoints = _.reduce(snapshots,
						function(memo,snapshot){
							return memo + (!accepted(snapshot.get("ScheduleState")) ? snapshot.get("PlanEstimate") : 0);
					},0);
					var mvpToDo = _.reduce(snapshots,
						function(memo,snapshot){
							return memo + 
								(me.useMVP===true && !(accepted(snapshot.get("ScheduleState"))) && isMVP(snapshot) ? 
								snapshot.get("PlanEstimate") : null);
					},0);
					var nonMvpToDo = _.reduce(snapshots,
						function(memo,snapshot){
							return memo + 
								(me.useMVP===true && !(accepted(snapshot.get("ScheduleState"))) && !isMVP(snapshot) ? 
								snapshot.get("PlanEstimate") : 0);
					},0);

					return {
						// iteration : me.iterations[i].get("Name"),
						iteration : me.iterations[i].raw.Name,
						endDate : me.iterations[i].raw.EndDate,
						Completed : completedPoints * -1, // show below y axis
						ToDo : todoPoints,
						MVP : mvpToDo,
						NonMVP : nonMvpToDo
					}
				});

				var series = _.map(
					me.useMVP !== true ? ["ToDo","Completed"] : ["MVP","NonMVP","Completed"],
					function(seriesName) {
						return {
							name : seriesName,
							type : 'column',
							data : _.map(seriesData,function(sd){
								return moment(sd.endDate) <= moment() ? sd[seriesName] : null
							})
						}
					}
				)

				console.log("seriesData",seriesData,series);

				// var categories = _.map(me.iterations,function(i) { return i.get("Name"); });
				var categories = _.map(me.iterations,function(i) { return i.raw.Name; });

				if (!_.isUndefined(me.chart)) {
					me.remove(that.chart);
				}
				me.chart = Ext.create('Rally.SolutionArchitect.Chart', {
					itemId: 'rally-chart',
					chartData: {
						series : series,
						categories : categories,
						chartColors : me.useMVP === true ? ['#0000FF', '#87CEEB', '#008000'] : ['#87CEEB', '#008000']
					},
					chartColors : me.useMVP === true ? ['#0000FF', '#87CEEB', '#008000'] : ['#87CEEB', '#008000']
				});
				me.add(me.chart);



			},
			failure : function(error) {
				me.hideMask();
				console.log("error---",error);
			}
		});
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
		            	me.lastState = lastState;
		        		deferred.resolve(lastState)
		            }
		        });
		    }
		});
		return deferred.promise;
	},

	getIterations : function() {

		var me = this;
		console.log("Reading iterations for " + me.maxMonths + " months");
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
				values.push(
				{
					raw : {
						StartDate : moment().toISOString(),
						EndDate : moment().toISOString(),
						Name : "Today"
					}
				});

				values = _.sortBy(values,function(value) { return moment(value.raw.EndDate);});
				console.log(_.map(values,function(v){return v.raw.Name}));
				me.iterations = values;
				deferred.resolve(values);
			},
			failure: function(error) {
				deferred.resolve([]);
			}
		});
		return deferred.promise;
	},

	getSnapshots : function(iterations) {
		console.log("iterations",iterations);
		var me = this;

		var promises = _.map(iterations,function(iteration) {
            var deferred = Ext.create('Deft.Deferred');
			me._loadASnapShotStoreWithAPromise(
				{
					_TypeHierarchy : { "$in" : ["HierarchicalRequirement"] },
					// _ProjectHierarchy : { "$in" : [me.getContext().getProject().ObjectID]},
					Project : me.getContext().getProject().ObjectID,
					// __At : "current",
					_ValidFrom : { "$lte" : iteration.raw.EndDate},
					_ValidTo : { "$gte" : iteration.raw.EndDate},
					Children : null
				}, 
				["ObjectID","FormattedID","PlanEstimate","ScheduleState"].concat( me.useMVP===true ? me.mvpField : "" ), 
				["ScheduleState"],
				null
			).then({
				scope: me,
				success: function(values) {
					deferred.resolve(values);
				},
				failure: function(error) {
					console.log("error",error);
					deferred.resolve([]);
				}
			});
			return deferred.promise;
        });

		var deferred = Ext.create('Deft.Deferred');
		Deft.Promise.all(promises).then( {
            scope : me,
            success : function(all) {
                console.log("all",all);
                deferred.resolve(all,iterations);
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
			pageSize : 4000,
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
        } else {
        	console.log("no element");
        }
    },
    hideMask: function() {
        this.getEl().unmask();
    },


    config: {
        defaultSettings: {
            usemvp  : false,
            mvpfield : "",
            mvpvalue : "",
            maxMonths : 6

        }
    },

    getSettingsFields: function() {
        var me = this;
        
        return [
	        {
	            name: 'usemvp',
	            xtype:'rallycheckboxfield',
	            fieldLabel: 'Show MVP',
	            labelWidth: 100,
	            labelAlign: 'left',
	            minWidth: 200,
	            margin: 10,
	        },
			{
	            name: 'mvpfield',
	            xtype:'rallytextfield',
	            fieldLabel: 'MVP Custom Field Name',
	            labelWidth: 100,
	            labelAlign: 'left',
	            minWidth: 200,
	            margin: 10,
	        },
	        {
	            name: 'mvpvalue',
	            xtype:'rallytextfield',
	            fieldLabel: 'MVP Field Value',
	            labelWidth: 100,
	            labelAlign: 'left',
	            minWidth: 200,
	            margin: 10,
	        },
	        {
	            name: 'maxMonths',
	            xtype:'rallytextfield',
	            fieldLabel: 'Maximum number of previous months to include iterations from ',
	            labelWidth: 100,
	            labelAlign: 'left',
	            minWidth: 200,
	            margin: 10,
	        }
        ];
    }


});
