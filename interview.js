const Client = require('node-rest-client-promise').Client;
var prompt = require('prompt');
var optimist = require('optimist');

let inputs = {
    url: 'https://x-pipes.vsts.me',
    repoName: 'xplatalm/cuckoo'
}

prompt.override = optimist.argv;
prompt.message = '?';
prompt.delimiter = ' ';

async function getInterview(inputs) {
    const client = new Client();
    const args = {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        data: {
            languageTag: "en-us",
            repository: {
                id: inputs.repoName
            }
        }
    };

    console.log('Getting interview:')
    const result = await client.postPromise(inputs.url + '/_apis/public/pipelines/interviews?api-version=5.0-preview.1', args);
    const interview = getJson(result);
    return interview;
}

async function getConfiguration(answers) {
    const client = new Client();
    const args = {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        data: {
            languageTag: "en-us",
            repository: {
                id: inputs.repoName
            }
        }
    };

    console.log('Getting interview:')
    const result = await client.postPromise(inputs.url + '/_apis/public/pipelines/interviews?api-version=5.0-preview.1', args);
    const interview = getJson(result);
    return interview;
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

function addQuestion(schema, question) {
    if (question.type === 'dropdown') {
        schema.properties[question.id] = {
            required: true, 
            description: question.text,
            conform: function (value) {
                let choices = [];
                for (option of question.options) {
                    choices.push(option.value);
                    if (value === option.value) {
                        return true;
                    }
                }
                console.log('Invalid answer. Your choices are: ' + choices.join(", "));
                return false;
            }
        };
    }
}

async function askQuestions(schema) {
    prompt.start();
    return new Promise((resolve, reject) => 
        prompt.get(schema, function (err, result) {
            if (err) {
                reject(err);
                return undefined;
            }
            resolve(result);
        }));
}

async function promptForInterviewAnswers(interview) {
    console.log(`Prompting user for answers to interview '${interview.name}'`);

    const schema = { properties: {} };
    for (const question of interview.questions) {
        addQuestion(schema, question);
    }

    return await askQuestions(schema);
}

async function run(inputs) {
    // Get an interview
    const interview = await getInterview(inputs);
    if (interview) {
        // Prompt for answers to interview questions
        const answers = await promptForInterviewAnswers(interview);

        console.log(answers);
        // Create configuration
        // const files = getConfiguration(answers);
    
        // Display configuration files
    } else {
        console.log("Unable to get interview.");
    }
}

run(inputs);