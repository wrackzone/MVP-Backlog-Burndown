Ext.define('Rally.SolutionArchitect.Chart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.progresschart',

    itemId: 'rally-chart',
    chartData: {},
    loadMask: false,
    chartColors : ['#0000FF', '#87CEEB', '#008000'],
    chartConfig: {
        
        chart: {
            type: 'column'
        },
        title: {
            text: 'MVP Burndown'
        },
        xAxis: {
                title: {
                    text: 'Iteration'
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