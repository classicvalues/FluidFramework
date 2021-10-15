/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ScriptoriumLambdaFactory } from "@fluidframework/server-lambdas";
import * as services from "@fluidframework/server-services";
import { ICollection, IDocument, IPartitionLambdaFactory, MongoManager } from "@fluidframework/server-services-core";
import { deleteSummarizedOps } from "@fluidframework/server-services-utils";
import { Provider } from "nconf";

export async function create(config: Provider): Promise<IPartitionLambdaFactory> {
    const mongoUrl = config.get("mongo:endpoint") as string;
    const mongoExpireAfterSeconds = config.get("mongo:expireAfterSeconds") as number;
    const deltasCollectionName = config.get("mongo:collectionNames:deltas");
    const createCosmosDBIndexes = config.get("mongo:createCosmosDBIndexes");
    const mongoFactory = new services.MongoDbFactory(mongoUrl);
    const mongoManager = new MongoManager(mongoFactory, false);

    const db = await mongoManager.getDatabase();
    const opCollection = db.collection(deltasCollectionName);
    await opCollection.createIndex(
        {
            "documentId": 1,
            "operation.term": 1,
            "operation.sequenceNumber": 1,
            "tenantId": 1,
        },
        true);

    if (createCosmosDBIndexes) {
        await opCollection.createIndex({
            "operation.term": 1,
            "operation.sequenceNumber": 1,
        }, false);

        await opCollection.createIndex({
            "operation.sequenceNumber": 1,
        }, false);
    }

    if (mongoExpireAfterSeconds > 0) {
        if (createCosmosDBIndexes) {
            await opCollection.createTTLIndex({_ts:1}, mongoExpireAfterSeconds);
        } else {
            await opCollection.createTTLIndex(
                {
                    mongoTimestamp: 1,
                },
                mongoExpireAfterSeconds,
            );
        }
    }

    const documentsCollection: ICollection<IDocument> = db.collection(config.get("mongo:collectionNames:documents"));
    await deleteSummarizedOps(opCollection, documentsCollection, 60000, 60000, true);

    return new ScriptoriumLambdaFactory(mongoManager, opCollection);
}
