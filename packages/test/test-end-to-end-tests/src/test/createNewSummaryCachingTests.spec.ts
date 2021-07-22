/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import assert from "assert";
import {
    ContainerRuntimeFactoryWithDefaultDataStore,
    DataObject,
    DataObjectFactory,
} from "@fluidframework/aqueduct";
import { ISummaryConfiguration } from "@fluidframework/protocol-definitions";
import { ITestObjectProvider } from "@fluidframework/test-utils";
import { requestFluidObject } from "@fluidframework/runtime-utils";
import { MockLogger } from "@fluidframework/test-runtime-utils";
import { describeNoCompat } from "@fluidframework/test-version-utils";
import { IContainerRuntimeOptions } from "@fluidframework/container-runtime";
import { AttachState } from "@fluidframework/container-definitions";
import { flattenRuntimeOptions } from "./flattenRuntimeOptions";

class TestDataObject extends DataObject {
    public get _root() {
        return this.root;
    }
    public get _context() {
        return this.context;
    }
}

describeNoCompat("Cache CreateNewSummary", (getTestObjectProvider) => {
    let provider: ITestObjectProvider;
    const dataObjectFactory = new DataObjectFactory(
        "TestDataObject",
        TestDataObject,
        [],
        []);

    const IdleDetectionTime = 100;
    const summaryConfigOverrides: Partial<ISummaryConfiguration> = {
        idleTime: IdleDetectionTime,
        maxTime: IdleDetectionTime * 12,
    };
    const runtimeOptions: IContainerRuntimeOptions = {
        summaryOptions: {
            generateSummaries: true,
            initialSummarizerDelayMs: 10,
            summaryConfigOverrides,
        },
        gcOptions: {
            gcAllowed: true,
        },
    };
    const runtimeFactory = new ContainerRuntimeFactoryWithDefaultDataStore(
        dataObjectFactory,
        [
            [dataObjectFactory.type, Promise.resolve(dataObjectFactory)],
        ],
        undefined,
        undefined,
        flattenRuntimeOptions(runtimeOptions),
    );

    let mockLogger: MockLogger;

    beforeEach(function() {
        provider = getTestObjectProvider();
        // Currently, only ODSP caches new summary.
        if (provider.driver.type !== "odsp") {
            this.skip();
        }
    });

    it("should fetch from cache when second client loads the container", async () => {
        mockLogger = new MockLogger();

        // Create a container for the first client.
        const mainContainer = await provider.createContainer(runtimeFactory, { logger: mockLogger });
        assert.strictEqual(mainContainer.attachState, AttachState.Attached, "container was not attached");

        // getting default data store and create a new data store
        const mainDataStore = await requestFluidObject<TestDataObject>(mainContainer, "default");
        const dataStore2 = await dataObjectFactory.createInstance(mainDataStore._context.containerRuntime);
        mainDataStore._root.set("dataStore2", dataStore2.handle);

        // second client loads the container
        const container2 = await provider.loadContainer(runtimeFactory, { logger: mockLogger });
        const defaultDataStore = await requestFluidObject<TestDataObject>(container2, "default");

        // getting the non-default data store and validate it is loaded
        const handle2 = await defaultDataStore._root.wait("dataStore2");
        const testDataStore: TestDataObject = await handle2.get();
        assert(testDataStore !== undefined, "2nd data store within loaded container is not loaded");

        // validate the snapshot was fetched from cache
        const fetchEvent = mockLogger.events.find((event) =>
            event.eventName === "fluid:telemetry:OdspDriver:ObtainSnapshot_end");
        assert(fetchEvent !== undefined, "odsp obtain snapshot event does not exist ");
        assert.strictEqual(fetchEvent.method, "cache",
            `second client fetched snapshot with ${fetchEvent.method} method instead of from cache`);
    });
});
