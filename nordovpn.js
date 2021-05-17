const https = require("https");
const path = require("path");
const fs = require("fs");

class NordOvpn {

    ovpn(type = "tcp", countryCode = "", user = "", password = "") {

		const endpoint = "https://nordvpn.com/wp-admin/admin-ajax.php?action=";

        return new Promise(async (resolve, reject) => {

			// fetch NordVPN country list
			this.fetch(endpoint + "servers_countries")
			.then(countries => {

				// fetch user infos
				this.fetch(endpoint + "get_user_info_data")
				.then(user_infos => {

					// provided country code or default to user info country
					countryCode = countryCode.toUpperCase() 
					|| user_infos.country_code;

					// find country
					const country = countries
					.find(cur => cur.code === countryCode);

					if(!country) 
						return reject("no country code" + countryCode);

					// fetch recommended servers
					this.fetch(endpoint + "servers_recommendations&filters={%22country_id%22:" + country.id + "}")
					.then(servers => {

						// first recommended server
						const server = servers.shift(), 
							name = server.hostname + "." + type + ".ovpn";

						// fetch profile data
						this.fetch("https://downloads.nordcdn.com/configs/files/ovpn_" + type + "/servers/" + name, false)
						.then(profile => {

							const credFile = path.join(
								__dirname, 
								"profiles", 
								"cred.txt"
							);

							// check credentials file exists
							fs.promises
							.access(credFile, fs.constants.F_OK)
							.then(() => {

								// read credentials file
								return fs.promises
								.readFile(
									credFile, 
									"utf8"
								)
								.then(cred => cred)
								.catch(cred_error => reject(cred_error));

							})
							.catch(() => {

								if(!user || !password) 
									reject("invalid credentials");

								// no credentials file, fallback to args
								return user + "\n" + password;

							})
							.then(cred => {

								// inject credentials inside ovpn profile
								profile = profile
								.replace(
									"auth-user-pass", 
									"<auth-user-pass>" 
									+ "\n" 
									+ cred 
									+ "\n" 
									+ "</auth-user-pass>" 
									+ "\n" 
									+ "setenv CLIENT_CERT 0"
								);

								const profilePath = path.join(
									__dirname, 
									"profiles", 
									name
								);
								
								// flush profile
								return fs.promises
								.writeFile(
									profilePath, 
									profile
								)
								.then(() => {

									resolve({
										server: server.hostname, 
										file: name
									});
		
								})
								.catch(write_error => reject(write_error));

							});

						})
						.catch(profile_error => reject(profile_error));

					})
					.catch(servers_error => reject(servers_error));

				})
				.catch(user_infos_error => reject(user_infos_error));

			})
			.catch(countries_error => reject(countries_error));				

        });

    }

    fetch(url, json = true) {

        return new Promise((resolve, reject) => {

            let data = "";

            https.get(
				url, 
				res => 
					res
					.on("data", chunk => data += chunk)
					.on("end", () => resolve(json ? JSON.parse(data) : data))
			)
			.on("error", err => reject(err));
       
		});
    }
	
}

const args = process.argv.slice(2);

if(args.length || require.main === module) {

	let options = args
	.reduce((acc, cur) => {
		if(~~cur.indexOf(":")) {
			let key_value = cur.split(":");
			acc[key_value[0]] = key_value[1];
		}
		return acc;
	}, {protocol: "tcp", country: "", user: "", password: ""});

	console.log("NORD OVPN", options.protocol, options.country, options.user, options.password);

	new NordOvpn()
	.ovpn(options.protocol, options.country, options.user, options.password)
	.then(res => console.log("success", res.server))
	.catch(err => console.log("error", err));

}

module.exports = NordOvpn;