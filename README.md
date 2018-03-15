# TabbyDriver
This nodeJS app prompts the user for inputs and then creates a Tabby connection in the specified VSTS account.

## To Install
Note: you may need a newer version of nodeJS that supports the async/await pattern.

    >cd TabbyDriver
    >npm install

## To Run
You can provide the needed information on the command line or you will be prompted for it. Many values have defaults.

Creating a new project... ***use a new project name***

    >node createConnection.js --url https://tabbydemo.visualstudio.com --project ANewProject --repo xplatalm/cuckoo --branch master --installationId 75537 --pat yourPATinfoHere

    Creating connection:
        Connection creation queued. Operation Url =>
        https://tabbydemo.visualstudio.com/_apis/operations/8d15a4c4-dd6a-4b8a-ad64-6be51188567c
    Waiting for project creation to complete:
        Team project ANewProject created.
        collectionId: 28f60aef-e768-4692-bff4-75e6480311da
        projectId: 30ce0e59-b36f-4d5a-a857-6b255ec49eae
    Waiting for definition creation to complete:
        Definition 11 created.
    Getting definition properties:
        Connection created correctly for provider github.
    done.

Making a connection in an existing project... ***use the project id***

    >node createConnection.js --url https://tabbydemo.visualstudio.com --project 30ce0e59-b36f-4d5a-a857-6b255ec49eae --repo xplatalm/cuckoo --branch master --installationId 75537 --pat yourPATinfoHere

    Creating connection:
        Connection created. Token =>
        eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50SWQiOiIyOGY2MGFlZi1lNzY4LTQ2OTItYmZmNC03NWU2NDgwMzExZGEiLCJwcm9qZWN0SWQiOiIzMGNlMGU1OS1iMzZmLTRkNWEtYTg1Ny02YjI1NWVjNDllYWUiLCJkZWZpbml0aW9uSWQiOiIxMiIsImlzcyI6InZzdHMueGxhdW5jaCIsImF1ZCI6InZzdHMiLCJuYmYiOi02MjEzNTU5MzEzOSwiZXhwIjotNjIxMzU1OTMxMzl9.UxYfxEgBpGdZia3PAYEXHk2hgAaZweWsdQzQea_6xQo
    done.

Sending an event as if it was from GitHub... ***you have to know the secret and the have the token***

    >node sendEvent.js --url https://tabbydemo.visualstudio.com --secret "secret" --payload "payload.json" --token eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50SWQiOiIyOGY2MGFlZi1lNzY4LTQ2OTItYmZmNC03NWU2NDgwMzExZGEiLCJwcm9qZWN0SWQiOiI4MGRhZmM4Ny05MjdhLTQyNjctYWEwYy05NzEzNjlhOTM4MjgiLCJkZWZpbml0aW9uSWQiOiIxMCIsImlzcyI6InZzdHMueGxhdW5jaCIsImF1ZCI6InZzdHMiLCJuYmYiOi02MjEzNTU5MzEzOSwiZXhwIjotNjIxMzU1OTMxMzl9.T3fdKo-bXxYKj_BNljcyWMSrC3nWEZUodsINbuZVsJc

    Sending event:
    done.

Getting the list of artifacts for a build... ***you have to know the secret, build id, and the token***

    >node getArtifacts.js --url https://tabbydemo.visualstudio.com --secret "secret" --buildId 13 --token eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50SWQiOiIyOGY2MGFlZi1lNzY4LTQ2OTItYmZmNC03NWU2NDgwMzExZGEiLCJwcm9qZWN0SWQiOiI4MGRhZmM4Ny05MjdhLTQyNjctYWEwYy05NzEzNjlhOTM4MjgiLCJkZWZpbml0aW9uSWQiOiIxMCIsImlzcyI6InZzdHMueGxhdW5jaCIsImF1ZCI6InZzdHMiLCJuYmYiOi02MjEzNTU5MzEzOSwiZXhwIjotNjIxMzU1OTMxMzl9.T3fdKo-bXxYKj_BNljcyWMSrC3nWEZUodsINbuZVsJc
    prompt: Artifact name (optional):

    Getting artifacts:
    { count: 1,
      value: [ { id: 0, name: 'system.logs', resource: [Object] } ] }
    done.

Downloading an artifact for a build... ***you have to know the secret, build id, the token, and the artifact name***

    >node getArtifacts.js --url https://tabbydemo.visualstudio.com --secret "secret" --buildId 13 --token eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50SWQiOiIyOGY2MGFlZi1lNzY4LTQ2OTItYmZmNC03NWU2NDgwMzExZGEiLCJwcm9qZWN0SWQiOiI4MGRhZmM4Ny05MjdhLTQyNjctYWEwYy05NzEzNjlhOTM4MjgiLCJkZWZpbml0aW9uSWQiOiIxMCIsImlzcyI6InZzdHMueGxhdW5jaCIsImF1ZCI6InZzdHMiLCJuYmYiOi02MjEzNTU5MzEzOSwiZXhwIjotNjIxMzU1OTMxMzl9.T3fdKo-bXxYKj_BNljcyWMSrC3nWEZUodsINbuZVsJc --artifactName system.logs

    Getting artifacts:
    { count: 1,
      value: [ { id: 0, name: 'system.logs', resource: [Object] } ] }
    Getting artifact system.logs:
    done.
        saving file to system.logs.zip

