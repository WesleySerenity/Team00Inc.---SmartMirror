//Wesley
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
			module: "EXT-Detector",
			position: "top_left",
			config: {
				debug: false,
				detectors: [
				  {
					detector: "Snowboy",
					Model: "jarvis",
					Sensitivity: null
				}
			  ]
			}
		},
		{
			module: 'EXT-Alert',
			config: {
				debug: false,
				style: 1,
				ignore: []
			}
		},
		{
			module: "MMM-GoogleAssistant",
			configDeepMerge: true,
			config: {
				assistantConfig: {
					latitude: 51,
					longitude:-0.07,
				},
			}
		}
	]
}

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") { module.exports = config; }
