//Biruk
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
			module: "MMM-MktIndex",
			position: "top_left",
			config: {
				timeFormat: "DD-MM HH:mm",
				symbols: ["^DJI", "^IXIC", "^GSPC"],
				alias: ["Dow 30", "Nasdaq", "S&P 500"],
				updateInterval: 180,
			}
		},
		
		{
			module: "compliments",
			position: "lower_third"
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
		{
			module: "MMM-MyStandings",
			position: "top_right",
			config: {
				updateInterval: 60 * 60 * 1000,
				rotateInterval: 1 * 60 * 1000,
				sports: [
				{ league: "NBA" },
				{ league: "ENG_PREMIERE_LEAGUE" },
		        { league: "UEFA_CHAMPIONS" }
		        
		       ],
				nameStyle: "short",
				showLogo: true,
				useLocalLogos: true,
				showByDivision: true,
				fadeSpeed: 2000,
			}
		}
	]
}


if (typeof module !== "undefined") { module.exports = config; }
