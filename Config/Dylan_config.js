//Dylan
let config = {
	address: "localhost",	
							
							
							
							
	port: 8080,
	basePath: "/",	
									
	ipWhitelist: ["127.0.0.1", "::ffff:127.0.0.1", "::1"],
									
									
									
									
	useHttps: false,			
	httpsPrivateKey: "",
	httpsCertificate: "",	

	language: "en",
	locale: "en-US",
	logLevel: ["INFO", "LOG", "WARN", "ERROR"], 
	timeFormat: 12,
	units: "imperial",

	modules: [
		
		
		{
			module: "alert",
		},
		{
			module: "clock",
			position: "top_left"
		},
		{
			module: "calendar",
			header: "US Holidays",
			position: "top_left",
			config: {
				calendars: [
					{
						fetchInterval: 7 * 24 * 60 * 60 * 1000,
						symbol: "calendar-check",
						url: "https://ics.calendarlabs.com/76/mm3137/US_Holidays.ics"
					}
				]
			}
		},
		{
			module: "compliments",
			position: "lower_third"
		},
		{
			module: "weather",
			position: "top_right",
			config: {
				weatherProvider: "openweathermap",
				type: "current",
				location: "San Jose",
				locationID: "5392171", //ID from http://openweathermap.org
				apiKey: "e9ed81c8a0846442a4b719bab181bf9a"
			}
		},
		{
			module: "weather",
			position: "top_right",
			header: "Weather Forecast",
			config: {
				weatherProvider: "openweathermap",
				type: "forecast",
				location: "San Jose",
				locationID: "5392171", //ID from http://openweathermap.org
				apiKey: "e9ed81c8a0846442a4b719bab181bf9a"
			}
		},
		
		{
			module: "newsfeed",
			position: "top_bar",
			config: {
				feeds: [
					{
						title: "New York Times",
						url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"
					}
				],
				showSourceTitle: true,
				showPublishDate: true,
				broadcastNewsFeeds: true,
				broadcastNewsUpdates: true
			}
		},
		
	]
}


if (typeof module !== "undefined") { module.exports = config; }
