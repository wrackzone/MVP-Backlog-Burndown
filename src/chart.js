Ext.define('Rally.SolutionArchitect.Chart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.progresschart',

    itemId: 'rally-chart',
    chartData: {},
    loadMask: false,
    // chartColors : ['#0000FF', '#87CEEB', '#008000'],
    chartConfig: {
        
        chart: {
            type: 'column'
        },
        title: {
            text: 'Project Burndown'
        },
        
        xAxis: {
                title: {
                    text: 'Iteration'
                },
                labels: {
                rotation: -45,
                style: {
                    fontSize: '10px',
                    fontFamily: 'Verdana, sans-serif'
                }
            }
        },
        yAxis: [
            {
                title: {
                    text: 'Points'
                }
            }
        ],

        plotOptions: {
            column : {


                dataLabels : {
                    enabled : true,
                    // color: '#274b6d',
                    borderRadius: 5,
                    backgroundColor: 'rgba(252, 255, 197, 0.7)',
                    borderWidth: 1,
                    borderColor: '#AAA',

                    formatter : function() {
                        return this.y !== 0 ? (this.y < 0 ? this.y * -1 : this.y) : "";
                    }
                }
            },
            series : {
                stacking : 'normal'
            }
        }
    },
    constructor: function (config) {
        this.callParent(arguments);
        if (config.title){
            this.chartConfig.title = config.title;
        }
    }
});