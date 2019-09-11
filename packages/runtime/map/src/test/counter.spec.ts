/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

// tslint:disable: newline-per-chained-call
// tslint:disable: no-backbone-get-set-outside-model
import { MockRuntime } from "@prague/runtime-test-utils";
import * as assert from "assert";
import * as map from "..";

describe("Routerlicious", () => {
    describe("Map", () => {
        describe("Counter", () => {
            let runtime: MockRuntime;
            let testMap: map.ISharedMap;
            let testCounter: map.Counter;

            beforeEach(async () => {
                runtime = new MockRuntime();
                const factory = new map.MapFactory();
                testMap = factory.create(runtime, "test");

                testCounter = testMap.
                    set("defaultCounter", undefined,
                        map.CounterValueType.Name).
                    get("defaultCounter");
            });

            describe(".constructor", () => {
                it("Should be able to create a counter with default value", async () => {
                    assert.ok(testCounter);
                    assert.equal(testCounter.value, 0);
                });

                it("Should be able to create a counter with predefined value", async () => {
                    const counterWithValue = testMap.
                        set("defaultCounter", 50, map.CounterValueType.Name).
                        get("defaultCounter");
                    assert.ok(counterWithValue);

                    /* tslint:disable:no-unsafe-any */
                    assert.equal(counterWithValue.value, 50);
                });
            });

            describe(".increment", () => {
                it("Should be able to increment a counter with positive and negative values", async () => {
                    testCounter.increment(20);
                    assert.equal(testCounter.value, 20);
                    testCounter.increment(-40);
                    assert.equal(testCounter.value, -20);
                });

                it("Should fire incremented listener callback after increment", () => {
                    let fired = false;

                    testCounter.on("incremented", (value: number) => {
                        fired = true;
                        assert.equal(value, 10);
                    });

                    testCounter.increment(10);
                    assert.ok(fired);
                });

                it("Should fire valueChanged listener callback on its container after increment", () => {
                    let fired = false;

                    testMap.on("valueChanged", () => {
                        fired = true;
                    });

                    testCounter.increment(10);
                    assert.ok(fired);
                });
            });
        });
    });
});
