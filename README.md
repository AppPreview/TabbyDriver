# TabbyDriver
This nodeJS app prompts the user for inputs and then creates a Tabby connection in the specified VSTS account.

## To Install
Note: you may need a newer version of nodeJS that supports the async/await pattern.
    >cd TabbyDriver
    >npm install

## To Run
You can provide the needed information on the command line or you will be prompted for it. Most values have defaults.

    >node createConnection.js --useOldAPI true --url https://tabbydemo.visualstudio.com --project Tabby-jlp5 --repo xplatalm/cuckoo --branch master --installationId 75537 --pat yourPATinfoHere

    Creating connection:
       Connection created. Token =>
       eyJBY2NvdW50SWQiOiI3Y2JiMmZkZS02NDk5LTRlZjQtYjdhNS01ZWE0YmZmMGFlZDciLCJUZWFtUHJvamVjdElkIjoiNjQwOTI1NDktMzFhNC00NTQ3LWI1OTQtMDBhZGNlZGY0ODg1IiwiUmVwb3NpdG9yeUlkIjoieHBsYXRhbG0vY3Vja29vIiwiUmVwb3NpdG9yeU5hbWUiOiJ4cGxhdGFsbS9jdWNrb28iLCJUYXJnZXRCcmFuY2giOiJtYXN0ZXIiLCJEZWZpbml0aW9uSWQiOjE0fQ==
    done.
