var prompt = require('prompt');
var optimist = require('optimist');
var Client = require('node-rest-client-promise').Client;

var inputs = {
    pat: '',
    repoName: '',
    token: ''
}

// Get any command line args to override prompts
prompt.override = optimist.argv;

async function getInputs(inputs) {
    prompt.start();
    var schema = {
        properties: {
          pat: { required: true, description: "GitHub PAT token", default: inputs.pat, hidden: true},
          repo: { required: true, description: "GitHub repo name", default: inputs.repoName },
          token: { required: true, description: "Resources token", default: inputs.token }
        }
      };
    return new Promise((resolve, reject) => 
        prompt.get(schema, function (err, result) {
            if (err) {
                reject(err);
                return;
            }
            inputs.pat = result.pat;
            inputs.repoName = result.repo;
            inputs.token = result.token;
            resolve(inputs);
        }));
}

function getPatAuthorizationHeader(pat) {
    const auth = 'Basic ' + new Buffer('pat:' + pat).toString('base64');
    return auth;
}

async function putResourcesToken(inputs) {
    const client = new Client();
    const args = {
        headers: { 
            'user-agent': 'node.js',
            'accept': 'application/vnd.github.fowler-preview',
            'Authorization': getPatAuthorizationHeader(inputs.pat)
        },
        data: `{ "value": "${inputs.token}" }`
        
    };

    const result = await client.putPromise('https://api.github.com/repos/' + inputs.repoName + '/flows/services/github-launch/microsoft-vsts-ci/credentials', args);
    const data = result.data;
    if (result.response.statusCode < 200 || result.response.statusCode >= 300) {
        console.log('Putting resource token failed. RESPONSE: ' + result.response.statusCode);
        if (result.data.message) {
            console.log(result.data.message);
        }
        return false;
    }

    return true;
}
 
async function run(inputs) {
    inputs = await getInputs(inputs);
    await putResourcesToken(inputs);
    console.log('done.');
}

run(inputs);