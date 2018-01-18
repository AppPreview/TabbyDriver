# TabbyDriver
This nodeJS app prompts the user for inputs and then creates a Tabby connection in the specified VSTS account.

## To Install
    >cd TabbyDriver
    >npm install

## To Run
You can provide the needed information on the command line or you will be prompted for it. Most values have defaults.

    >node main.js --url https://me.vsts.me --project MyProject --pat eh74vmg5rswjk2xajuj3ll7zv6buha2xd7lz2f5n425gd7qd34lq --repo xplatalm/cuckoo --branch master --installationId 75537

    Getting vsts info:
       collectionId = 2c31a8a4-3ce2-4230-954d-29653ac881d9
       projectId = adc3d884-75ff-48ed-9c9f-e1f126d5be30
    Creating connection:
       Connection created.