const Client = require('node-rest-client-promise').Client;
const prompt = require('prompt');
const optimist = require('optimist');
const path = require('path');
const fs = require('fs');

let inputs = {
    url: 'https://x-pipes.visualstudio.com',
    repoName: 'xplatalm/cuckoo',
    interviewType: '',
    configFolder: ''
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
    let url = inputs.url + '/_apis/public/pipelines/interviews?api-version=5.0-preview.1';
    if (inputs.interviewType) {
        url = url + `&type=${inputs.interviewType}`;
    }
    const result = await client.postPromise(url, args);
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
            answers: {
            }
        }
    };

    for (answer in answers) {
        args.data.answers[answer] = answers[answer];
    }

    console.log('Getting config:')
    let url = inputs.url + '/_apis/public/pipelines/configurations?api-version=5.0-preview.1';
    if (inputs.interviewType) {
        url = url + `&type=${inputs.interviewType}`;
    }
    const result = await client.postPromise(url, args);
    const config = getJson(result);
    return config;
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

async function writeConfigFiles(config, folderPath) {
    for (const configFile of config.files) {
        const filePath = path.resolve(path.join(folderPath, configFile.path));
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        let content = configFile.content;
        if (configFile.isBase64Encoded) {
            content = Buffer.from(content, 'base64');
        }
        await createFile(filePath, content);
    }
}

async function run(inputs) {
    // Check args
    inputs.interviewType = optimist.argv.type;
    inputs.configFolder = optimist.argv.configFolder;
    inputs.repoName = optimist.argv.repo;

    // Get an interview
    const interview = await getInterview(inputs);
    if (interview) {
        // Prompt for answers to interview questions
        const answers = await promptForInterviewAnswers(interview);

        // Create configuration
        const config = await getConfiguration(answers);
        
        if (inputs.configFolder) {
            await writeConfigFiles(config, inputs.configFolder);
            console.log(`\nConfig files written to ${inputs.configFolder}`);
        } else {
            // Display configuration files
            console.log('\n******** Configuration Files *********');
            console.log(config);
            console.log('**************************************\n');
        }
    } else {
        console.log("Unable to get interview.");
    }
}

run(inputs);