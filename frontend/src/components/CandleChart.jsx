import React from 'react';
import Chart from 'react-apexcharts';

const CandleChart = ({ data, height = 350 }) => {
    if (!data || data.length === 0) return null;

    const series = [
        {
            name: 'Candle',
            type: 'candlestick',
            data: data.map(d => ({
                x: d.date, // Use string for category axis
                y: [d.open, d.high, d.low, d.close]
            }))
        },
        {
            name: 'MA10',
            type: 'line',
            data: data.map(d => ({
                x: d.date,
                y: d.ma_ultra_short
            }))
        },
        {
            name: 'MA20',
            type: 'line',
            data: data.map(d => ({
                x: d.date,
                y: d.ma_short
            }))
        },
        {
            name: 'MA60',
            type: 'line',
            data: data.map(d => ({
                x: d.date,
                y: d.ma_long
            }))
        }
    ];

    const options = {
        chart: {
            type: 'candlestick',
            height: height,
            toolbar: { show: false },
            background: 'transparent',
            animations: { enabled: false }
        },
        theme: { mode: 'dark' },
        stroke: { width: [1, 1, 1, 1], curve: 'smooth' },
        colors: ['#00E396', '#A855F7', '#FEB019', '#008FFB'], // Candle, MA10 (Purple), MA20 (Yellow), MA60 (Blue)
        plotOptions: {
            candlestick: {
                colors: {
                    upward: '#26a69a',
                    downward: '#ef5350'
                },
                wick: { useFillColor: true }
            }
        },
        xaxis: {
            type: 'category', // Changed from datetime to category to skip gaps
            tooltip: { enabled: true },
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                formatter: function (val) {
                    // Show simpler date format if needed, or keeping full string
                    // val is likely "YYYY-MM-DD"
                    if (typeof val === 'string' && val.length > 5) {
                        return val.substring(5).replace('-', '/'); // "MM/DD"
                    }
                    return val;
                }
            },
            tickAmount: 6 // Limit ticks to avoid crowding
        },
        yaxis: {
            tooltip: { enabled: true },
            labels: {
                formatter: value => value ? value.toFixed(0) : ''
            }
        },
        grid: {
            borderColor: '#333',
            strokeDashArray: 3
        },
        legend: { show: true, position: 'top' }
    };

    return (
        <div className="w-full h-full text-black">
            <Chart options={options} series={series} type="candlestick" height={height} />
        </div>
    );
};

export default CandleChart;
