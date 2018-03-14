var fs = require('fs');
var crypto = require('crypto');
var prompt = require('prompt');
var optimist = require('optimist');
var Client = require('node-rest-client-promise').Client;

var inputs = {
    url: 'https://tabbydemo.visualstudio.com',
    token: '',
    signingSecret: '',
    buildId: '',
    artifactName: ''
}

// Get any command line args to override prompts
prompt.override = optimist.argv;

async function getInputs(inputs) {
    prompt.start();
    var schema = {
        properties: {
          url: { required: true, description: "VSTS account URL", default: inputs.url },
          token: { required: true, description: "Resources token", default: inputs.token },
          secret: { required: true, description: "Signing secret", default: inputs.signingSecret },
          buildId: { required: true, description: "Build id", default: inputs.buildId },
          artifactName: { required: false, description: "Artifact name (optional)", default: inputs.artifactName }
        }
      };
    return new Promise((resolve, reject) => 
        prompt.get(schema, function (err, result) {
            if (err) {
                reject(err);
                return;
            }
            inputs.url = result.url;
            inputs.token = result.token;
            inputs.signingSecret = result.secret;
            inputs.buildId = result.buildId;
            inputs.artifactName = result.artifactName;

            resolve(inputs);
        }));
}

function getPayload(inputs) {
    return `{ "buildId": ${inputs.buildId} }`
}

function getPayloadSignature(inputs, payload) {
    hash = crypto.createHmac('sha1', inputs.signingSecret).update(payload).digest('hex');
    return hash;
}

async function getArtifacts(inputs) {
    const payload = getPayload(inputs);
    const payloadSignature = getPayloadSignature(inputs, payload);

    const client = new Client();
    const args = {
        headers: { 
            'content-type': 'application/json',
            'x-hub-signature': `sha1=${payloadSignature}`,
            'x-github-resources': inputs.token
        },
        data: payload
    };

    let apiURL = 'https://x-pipes.visualstudio.com/_apis/public/Pipelines/Artifacts?provider=github&api-version=4.1-preview';
    if (inputs.url && inputs.url.indexOf('.vsts.me') > -1) {
        apiURL = 'https://x-pipes.vsts.me/_apis/public/Pipelines/Artifacts?provider=github&api-version=4.1-preview';
    }

    console.log('Getting artifacts:')
    const result = await client.postPromise(apiURL, args);
    const json = getJson(result);
    if (json) {
        console.log(json);
        if (inputs.artifactName) {
            getArtifactByName(json.value, inputs.artifactName);
        }
    }
}

async function getArtifactByName(artifacts, name) {
    let artifact = undefined;
    if (artifacts) {
        for (let i = 0; i < artifacts.length; i++) {
            if (artifacts[i].name === name) {
                artifact = artifacts[i];
                break;                
            }
        }
    }

    if (!artifact) {
        console.log('Unable to find an artifact with the name ' + name);
        return undefined;
    }

    const url = artifact.resource.downloadUrl;
    const client = new Client();
    const args = {
        headers: { 
            'accept': '*/*',
            'X-VSS-DownloadTicket': `${artifact.resource.downloadTicket}`
        }
    };

    console.log(`Getting artifact ${name}:`);
    const result = await client.getPromise(url, args);
    if (result.response.statusCode < 200 || result.response.statusCode >= 300) {
        // This is not a success code so print the response and return undefined
        console.log('RESPONSE: ' + result.response.statusCode);
        console.log(result.response);
        console.log('RESPONSE: ' + result.response.statusCode);
    } else {
        const filename = name + '.zip';
        console.log('    saving file to ' + filename);
        await createFile(filename, result.data);
    }
}

async function createFile(filename, data) {
    return new Promise((resolve, reject) => 
        fs.writeFile(filename, data, function(err) {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        }));
}

function getJson(result) {
    if (result.response.statusCode === 404) {
        console.log('RESPONSE: ' + result.response.statusCode);
        console.log('Make sure you have the feature flags installed: Pipelines.GetTicketedArtifacts');
    } else if (result.response.statusCode < 200 || result.response.statusCode >= 300) {
        // This is not a success code so print the response and return undefined
        console.log('RESPONSE: ' + result.response.statusCode);
        console.log(result.response);
        console.log('RESPONSE: ' + result.response.statusCode);
    } else {
        const data = result.data;
        if (Buffer.isBuffer(data)) {
            const text = new Buffer(data).toString('ascii');
            if (text.startsWith('{')) {
                const json = JSON.parse(text);
                return json;
            } else {
                console.log(`Unable to get json. Details:`);                
                console.log(text);
                console.log(result.response);
            }
        } else if (data && data.message) {
            console.log(data.message);
        } else {
            console.log('Unknown error occured');
        }
    }

    return undefined;
}

async function run(inputs) {
    inputs = await getInputs(inputs);
    await getArtifacts(inputs);
    console.log('done.');
}

run(inputs);