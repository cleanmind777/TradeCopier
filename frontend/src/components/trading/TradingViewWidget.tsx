import React, { useEffect } from 'react';

interface TradingViewWidgetProps {
    symbol: string;
    interval?: string;
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ symbol, interval = '1D' }) => {
    useEffect(() => {
        console.log('Mounting TradingViewWidget');
        
        // Check if TradingView script is already loaded
        const existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
        
        const initWidget = () => {
            const container = document.getElementById('tradingview_chart_container');
            // @ts-ignore
            if (window.TradingView && container) {
                try {
                    // Clear container first
                    container.innerHTML = '';
                    
                    // @ts-ignore
                    new window.TradingView.widget({
                        container_id: 'tradingview_chart_container',
                        width: '100%',
                        height: 500,
                        symbol: symbol,
                        interval: interval,
                        timezone: 'Etc/UTC',
                        theme: 'dark',
                        style: '1',
                        locale: 'en',
                        toolbar_bg: '#f1f3f6',
                        enable_publishing: true,
                        allow_symbol_change: true,
                        hide_top_toolbar: false,
                        hide_legend: false,
                        save_image: false,
                        studies: ['MACD@tv-basicstudies'],
                        details: true,
                    });
                } catch (error) {
                    console.error('Error initializing TradingView widget:', error);
                }
            }
        };

        if (existingScript) {
            // Script already loaded, just initialize widget
            initWidget();
        } else {
            // Load script
            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = initWidget;
            script.onerror = (error) => {
                console.error('Error loading TradingView script:', error);
            };
            document.body.appendChild(script);
        }

        return () => {
            console.log('Unmounting TradingViewWidget');
            // Clear the container on unmount
            const container = document.getElementById('tradingview_chart_container');
            if (container) {
                container.innerHTML = '';
            }
        };
    }, [symbol, interval]);

    return (
        <div className="w-full">
            <div id="tradingview_chart_container" className="w-full" />
        </div>
    );
};

export default TradingViewWidget;
