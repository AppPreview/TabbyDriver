var prompt = require('prompt');
var optimist = require('optimist');
var Client = require('node-rest-client-promise').Client;

var inputs = {
    url: 'https://tabbydemo.visualstudio.com',
    pat: '',
    projectId: '',
    project: 'Tabby-jpricket', // TODO put the TabbyDemo id (5f2c7436-88d8-4b1a-879a-7645f0f3710c) here instead of name to reuse that project
    repoName: 'xplatalm/cuckoo', // Need new test repo
    branch: 'master',
    installationId: '75537', // Need new App id
    yamlPath: '.vsts/microsoft.yml',
    routing: 'ResourcesToken'
}

// Get any command line args to override prompts
prompt.override = optimist.argv;

async function getInputs(inputs) {
    prompt.start();
    var schema = {
        properties: {
          url: { required: true, description: "VSTS account URL", default: inputs.url },
          project: { required: true, description: "New project name (or existing project id)", default: inputs.project},
          pat: { required: true, description: "PAT token", default: inputs.pat, hidden: true},
          repo: { required: true, description: "GitHub repo name", default: inputs.repoName },
          branch: { required: true, description: "Repo branch", default: inputs.branch },
          installationId: { required: true, description: "GitHub app installation id", default: inputs.installationId },
          routing: { required: true, description: "Connection routing method (ResourceToken | HostIdMapping)", default: inputs.routing },
        }
      };
    return new Promise((resolve, reject) =>
        prompt.get(schema, function (err, result) {
            if (err) {
                reject(err);
                return;
            }

            if (result.pat.length != 52) {
                reject('PAT should be 52 characters.');
                return;
            }

            inputs.url = result.url;
            inputs.pat = result.pat;
            inputs.repoName = result.repo;
            inputs.branch = result.branch;
            inputs.installationId = result.installationId;
            inputs.routing = result.routing;

            // If the user passed in the project Id, put it in the right input
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.project)) {
                inputs.projectId = result.project;
                inputs.project = '';
            } else {
                inputs.projectId = '';
                inputs.project = result.project;
            }

            resolve(inputs);
        }));
}

function getPatAuthorizationHeader(pat) {
    const auth = 'Basic ' + new Buffer('pat:' + pat).toString('base64');
    return auth;
}

async function getVstsInfo(inputs) {
    const client = new Client();
    const args = {
        headers: {
            'accept': 'application/json',
            'Authorization': getPatAuthorizationHeader(inputs.pat)
        }
    };

    const result = await client.getPromise(inputs.url + '/_git/' + inputs.project + '/vsts/info', args);
    const data = result.data;
    if (result.response.statusCode < 200 || result.response.statusCode >= 300) {
        console.log('Getting VSTS Info failed. RESPONSE: ' + result.response.statusCode);
        return {
            collectionId: 'unknown',
            projectId: 'unknown'
        };
    }

    return {
        collectionId: data.collection.id,
        projectId: data.repository.project.id
    };
}

async function createConnection(inputs) {
    const client = new Client();
    const createDefinition = inputs.routing === 'ResourcesToken' ? true : false;
    const args = {
        headers: {
            'content-type': 'application/json',
            'Authorization': getPatAuthorizationHeader(inputs.pat)
        },
        data: `{
                   "providerId": "github",
                   "project": {
                       "Id": "${inputs.projectId}",
                       "name": "${inputs.project}",
                       "visibility": 0
                   },
                   "repositoryId": "${inputs.repoName}",
                   "repositoryName": "${inputs.repoName}",
                   "targetBranch": "master",
                   "configurationFilePath": ".vsts/microsoft.yml",
                   "providerData": { "installationId": "${inputs.installationId}" },
                   "routingMethod": "${inputs.routing}",
                   "createBuildDefinition": ${createDefinition}
               }`
    };
    let apiURL = inputs.url + '/_apis/Pipelines/Connections?api-version=4.1-preview';

    console.log('Creating connection:')
    const result = await client.postPromise(apiURL, args);
    const json = getJson(result);
    if (json) {
        if (json.status === 'succeeded' || json.status === 'Complete') {
            console.log(`   Connection created. Token =>`);
            console.log(`   ${json.resultMessage}`);
            console.log(`   Definition: ${json.url}`);
        } else {
            let operationsUrl = json.url;
            console.log(`   Connection creation queued. Operation Url =>`);
            console.log(`   ${operationsUrl}`);
            const createdProjectId = await waitForProjectCreation(operationsUrl, inputs);
            if (createdProjectId) {
                if (inputs.routing == 'ResourceToken') {
                    // "Tabby" flow. Poll the service until a build definition shows up.
                    const definitionId = await waitForDefinitionCreation(inputs);
                    if (definitionId > 0) {
                        const definition = await getDefinition(inputs, definitionId);
                        if (definition && definition.properties && definition.properties.PipelinesProvider) {
                            console.log(`   Connection created correctly for provider ${definition.properties.PipelinesProvider.$value}.`);
                        } else {
                            console.log(`   Something happened trying to get the definition from url: ${inputs.url}/${inputs.project}/_apis/build/definitions/${definitionId}?propertyFilters=*`);
                        }
                    }
                }
                else {
                    // "Chesire" flow. Redirect the user to create the first build definition.
                    console.log('Creating the connection a second time, just to get the redirect url for creating a new build definition.');
                    inputs.projectId = createdProjectId;
                    await createConnection(inputs);
                }
            }
        }
    }
}

async function waitForProjectCreation(operationUrl, inputs) {
    const client = new Client();
    const args = {
        headers: {
            'content-type': 'application/json',
            'Authorization': getPatAuthorizationHeader(inputs.pat)
        }};

    console.log('Waiting for project creation to complete:')
    while (true) {
        await sleep(5);
        const result = await client.getPromise(operationUrl, args);
        const json = getJson(result);
        if (!json) {
            break;
        }
        if (json.status === 'succeeded') {
            const info = await getVstsInfo(inputs);
            console.log(`   Team project ${inputs.project} created.`);
            console.log(`   collectionId: ${info.collectionId}`);
            console.log(`   projectId: ${info.projectId}`);

            return info.projectId;
        } else if (json.status === 'failed') {
            console.log(`   Team project failed to be created. Project name = ${inputs.project}.`);
            break;
        }
        // continue in the loop
    }
    return null;
}

function getJson(result) {
    if (result.response.statusCode < 200 || result.response.statusCode >= 300) {
        // This is not a success code so print the response and return undefined
        console.log('RESPONSE: ' + result.response.statusCode);
        console.log(result.response);
        console.log('RESPONSE: ' + result.response.statusCode);
        return undefined;
    }

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

    return undefined;
}

async function waitForDefinitionCreation(inputs) {
    const client = new Client();
    const args = {
        headers: {
            'content-type': 'application/json',
            'Authorization': getPatAuthorizationHeader(inputs.pat)
        }};

    console.log('Waiting for definition creation to complete:');
    const definitionUrl = `${inputs.url}/${inputs.project}/_apis/build/definitions`;
    while(true) {
        await sleep(5);
        const result = await client.getPromise(definitionUrl, args);
        const json = getJson(result);
        if (!json) {
            break;
        }
        if (json.count > 0) {
            const definitionId = json.value[0].id;
            console.log(`   Definition ${definitionId} created.`);
            return definitionId;
        }
        console.log("Definition not created yet. Sleeping and checking again.");
        // continue with the loop
    }
    return -1;
}

async function getDefinition(inputs, definitionId) {
    const client = new Client();
    const args = {
        headers: {
            'content-type': 'application/json',
            'Authorization': getPatAuthorizationHeader(inputs.pat)
        }};

    console.log('Getting definition properties:');
    const definitionUrl = `${inputs.url}/${inputs.project}/_apis/build/definitions/${definitionId}?propertyFilters=*`;
    const result = await client.getPromise(definitionUrl, args);
    const json = getJson(result);
    if (json && json.id === definitionId) {
        return json;
    }
    return undefined;
}

function sleep(seconds) {
    return new Promise(resolve => {
        setTimeout(resolve, seconds * 1000);
    });
}

async function run(inputs) {
    inputs = await getInputs(inputs);
    await createConnection(inputs);
    console.log('done.');
}

run(inputs);