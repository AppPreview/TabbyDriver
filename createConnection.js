var prompt = require('prompt');
var optimist = require('optimist');
var Client = require('node-rest-client-promise').Client;

var inputs = {
    useOldAPI: true,
    url: 'https://tabbydemo.visualstudio.com',
    pat: '',
    projectId: '',
    project: 'Tabby-jpricket', // TODO put the TabbyDemo id (5f2c7436-88d8-4b1a-879a-7645f0f3710c) here instead of name to reuse that project
    repoName: 'xplatalm/cuckoo', // Need new test repo
    branch: 'master',
    installationId: '75537', // Need new App id
    yamlPath: '.vsts/microsoft.yml'
}

// Get any command line args to override prompts
prompt.override = optimist.argv;

async function getInputs(inputs) {
    prompt.start();
    var schema = {
        properties: {
          url: { required: true, description: "VSTS account URL", default: inputs.url },
          project: { required: true, description: "New project name (or existing id)", default: inputs.project},
          pat: { required: true, description: "PAT token", default: inputs.pat, hidden: true},
          repo: { required: true, description: "GitHub repo name", default: inputs.repoName },
          branch: { required: true, description: "Repo branch", default: inputs.branch },
          installationId: { required: true, description: "GitHub app installation id", default: inputs.installationId },
        }
      };
    return new Promise((resolve, reject) => 
        prompt.get(schema, function (err, result) {
            if (err) {
                reject(err);
                return;
            }
            inputs.useOldAPI = false;
            inputs.url = result.url;
            inputs.pat = result.pat;
            inputs.repoName = result.repo;
            inputs.branch = result.branch;
            inputs.installationId = result.installationId;

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
    const args = {
        headers: { 
            'content-type': 'application/json',
            'Authorization': getPatAuthorizationHeader(inputs.pat)
        },
        // TODO remove yamlPath when you remove the OLD API code paths
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
                   "yamlPath": ".vsts/microsoft.yml",
                   "providerData": { "installationId": "${inputs.installationId}" }
               }`
    };
    let apiURL = inputs.url + '/_apis/Pipelines/Connections?api-version=4.1-preview';
    if (inputs.useOldAPI) {
        args.data = `{
            "providerId": "github",
            "project": {    
                "Id": "${inputs.projectId}",
                "name": "${inputs.project}",
                "visibility": 0
            },
            "repositoryId": "${inputs.repoName}",
            "repositoryName": "${inputs.repoName}",
            "targetBranch": "master",
            "yamlPath": ".vsts/microsoft.yml",
            "providerData": "${inputs.installationId}"
        }`
    }

    console.log('Creating connection:')
    const result = await client.postPromise(apiURL, args);
    const json = getJson(result);
    if (json) {
        if (json.status === 'succeeded' || json.status === 'Complete') {
            console.log(`   Connection created. Token =>`);
            if (inputs.useOldAPI && json.connection) {
                console.log(`   ${json.connection.token}`);                
            } else {
                console.log(`   ${json.resultMessage}`);                 
            }
        } else {
            let operationsUrl = json.url;
            if (inputs.useOldAPI) {
                operationsUrl = `${inputs.url}/_apis/operations/${json.jobId}`;
            }
            console.log(`   Connection creation queued. Operation Url =>`);
            console.log(`   ${operationsUrl}`);
            const projectCreated = await waitForProjectCreation(operationsUrl, inputs);
            if (projectCreated) {
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
            return true;
        } else if (json.status === 'failed') {
            console.log(`   Team project failed to be created. Project name = ${inputs.project}.`);
            break;
        }
        // continue in the loop
    }
    return false;
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