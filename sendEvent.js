var fs = require('fs');
var crypto = require('crypto');
var prompt = require('prompt');
var optimist = require('optimist');
var Client = require('node-rest-client-promise').Client;

var inputs = {
    url: 'https://tabbydemo.visualstudio.com',
    token: '',
    signingSecret: '',
    payloadFilename: 'payload.json',
    eventType: 'check_suite'
}

// Get any command line args to override prompts
prompt.override = optimist.argv;

async function getInputs(inputs) {
    prompt.start();
    var schema = {
        properties: {
          url: { required: true, description: "VSTS account URL", default: inputs.url },
          token: { required: false, description: "Resources token", default: inputs.token },
          secret: { required: true, description: "Signing secret", default: inputs.signingSecret },
          payload: { required: true, description: "Payload file name", default: inputs.payloadFilename },
          eventType: { required: true, description: "Event type (check_suite, pull_request, push)", default: inputs.eventType }
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
            inputs.payloadFilename = result.payload;
            inputs.eventType = result.eventType;

            resolve(inputs);
        }));
}

async function getPayload(inputs) {
    return new Promise((resolve, reject) => 
        fs.readFile(inputs.payloadFilename, {encoding: 'utf-8'}, function(err, data) {
            if (err) {
                reject(err);
                return;
            }

            resolve(data);
        }));
}

function getPayloadSignature(inputs, payload) {
    hash = crypto.createHmac('sha1', inputs.signingSecret).update(payload).digest('hex');
    return hash;
}

async function sendEvent(inputs) {
    const payload = await getPayload(inputs);
    const payloadSignature = getPayloadSignature(inputs, payload);

    const client = new Client();
    const args = {
        headers: { 
            'content-type': 'application/json',
            'x-github-delivery': '78f3c850-013f-11e8-8cd2-115ebdd95f8b',
            'x-github-event': inputs.eventType,
            'x-hub-signature': `sha1=${payloadSignature}`,
            'x-github-resources': inputs.token
        },
        data: payload
    };

    let apiURL = 'https://x-pipes.visualstudio.com/_apis/public/Pipelines/Events?provider=github&api-version=4.1-preview';
    if (inputs.url && inputs.url.indexOf('.vsts.me') > -1) {
        apiURL = 'https://x-pipes.vsts.me/_apis/public/Pipelines/Events?provider=github&api-version=4.1-preview';
    } else if (inputs.url && inputs.url.indexOf('codedev.ms') > -1) {
        apiURL = 'https://x-pipes.vsts.me/_apis/public/Pipelines/Events?provider=github&api-version=4.1-preview';
    }

    console.log('Sending event:')
    const result = await client.postPromise(apiURL, args);
    if (result.response.statusCode != 200) {
        // This is not a success code so print the response and return undefined
        console.log('RESPONSE: ' + result.response.statusCode);
        console.log(result.response);
        console.log('RESPONSE: ' + result.response.statusCode);
    }
}

async function run(inputs) {
    inputs = await getInputs(inputs);
    await sendEvent(inputs);
    console.log('done.');
}

run(inputs);