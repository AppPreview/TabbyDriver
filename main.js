var prompt = require('prompt');
var optimist = require('optimist');
var Client = require('node-rest-client').Client;

var inputs = {
    url: 'https://me.vsts.me',
    pat: '',
    collectionId: '',
    projectId: '',
    project: 'MyProject',
    repoName: 'xplatalm/cuckoo',
    branch: 'master',
    installationId: '75537',
    yamlPath: '.vsts/microsoft.yml'
}

// Get any command line args to override prompts
prompt.override = optimist.argv;

function run(inputs) {
    prompt.start();
    var schema = {
        properties: {
          url: { required: true, description: "VSTS account URL", default: inputs.url },
          project: { required: true, description: "Project name", default: inputs.project},
          pat: { required: true, description: "PAT token", default: inputs.pat, hidden: true},
          repo: { required: true, description: "GitHub repo name", default: inputs.repoName },
          branch: { required: true, description: "Repo branch", default: inputs.branch },
          installationId: { required: true, description: "GitHub app installation id", default: inputs.installationId },
        }
      };
    prompt.get(schema, function (err, result) {
        inputs.url = result.url;
        inputs.pat = result.pat;
        inputs.project = result.project;
        inputs.repoName = result.repo;
        inputs.branch = result.branch;
        inputs.installationId = result.installationId;

        getVstsInfo(inputs);
    });
}

function getPatAuthorizationHeader(pat) {
    const auth = 'Basic ' + new Buffer('pat:' + pat).toString('base64');
    return auth;
}

function getVstsInfo(inputs) {
    const client = new Client();
    const args = {
        headers: { 
            'accept': 'application/json',
            'Authorization': getPatAuthorizationHeader(inputs.pat)
        }
    };

    console.log('Getting vsts info:')
    client.get(inputs.url + '/_git/' + inputs.project + '/vsts/info', args, function (data, response) {
        if (Buffer.isBuffer(data)) {
            console.log(`Unable to get vsts info for project: ${inputs.project}. Check your PAT. Details:`);
            console.log(new Buffer(data).toString('ascii'));
        } else if (data && data.message) {
            console.log(data.message);
        } else if (data) {
            console.log(`   collectionId = ${data.collection.id}`);
            console.log(`   projectId = ${data.repository.project.id}`);
            inputs.collectionId = data.collection.id;
            inputs.projectId = data.repository.project.id;
            createConnection(inputs);
        }
    }); 
}

function createConnection(inputs) {
    const client = new Client();
    const args = {
        headers: { 
            'content-type': 'application/json',
            'Authorization': getPatAuthorizationHeader(inputs.pat)
        },
        data: `{
                "accountId": "${inputs.collectionId}",
                "teamProjectId": "${inputs.projectId}",
                "repositoryId": "${inputs.repoName}",
                "repositoryName": "${inputs.repoName}",
                "targetBranch": "${inputs.branch}",
                "yamlPath": "${inputs.yamlPath}",
                "providerData": "${inputs.installationId}"
               }`        
    };

    console.log('Creating connection:')
    client.post(inputs.url + '/_apis/Pipelines/Connections?provider=github&api-version=4.1-preview', args, function (data, response) {
        if (Buffer.isBuffer(data)) {
            const text = new Buffer(data).toString('ascii');
            if (text.startsWith('{')) {
                const json = JSON.parse(text);
                console.log(`   Connection created. Token =>`);
                console.log(`   ${json.token}`);
            } else {
                console.log(`Unable to create connection. inputs: ${JSON.stringify(args.data)}. Details:`);
                console.log(text);
            }
        } else if (data && data.message) {
            console.log(data.message);
        } else {
            console.log('Unknown error occured');
        }
    });        
}
 
run(inputs);