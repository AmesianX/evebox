/* Copyright (c) 2014-2016 Jason Ish
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
 * IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

import {Injectable} from "@angular/core";
import {Http, Response} from "@angular/http";

import moment = require("moment");
import {Observable} from "rxjs/Rx";
var queue = require("queue");

export interface AlertGroup {
    count:number,
    escalatedCount:number,
    newestTs:string,
    oldestTs:string,
    event:any
}

@Injectable()
export class ElasticSearchService {

    private defaultBatchSize:number = 1000;
    private url:string = window.location.pathname + "elasticsearch";
    private index:string = "logstash-*";
    private jobs = queue({concurrency: 16});

    constructor(private http:Http) {
    }

    /**
     * Get the current job size.
     */
    jobSize():number {
        return this.jobs.length;
    }

    search(query:any):Promise<any> {
        return this.http.post(`${this.url}/${this.index}/_search`, JSON.stringify(query))
            .toPromise()
            .then(response => response.json());
    }

    bulk(commands:any[]):Promise<any> {
        let request = commands.map(command => {
                return JSON.stringify(command);
            }).join("\n") + "\n";
        return this.http.post(`${this.url}/_bulk?refresh=true`, request)
            .map(response => {
                return response.json();
            })
            .toPromise();
    }

    submit(func:any) {

        let p = new Promise<any>((resolve, reject) => {

            this.jobs.push((cb:any) => {
                func().then(() => {
                    cb();
                });
            });

        });

        this.jobs.start();

        return p;
    }

    getAlertsInAlertGroup(alertGroup:AlertGroup, options?:any) {

        // Make sure options is at least an empty object.
        options = options || {};

        let query = {
            query: {
                filtered: {
                    filter: {
                        and: [
                            {exists: {field: "event_type"}},
                            {term: {event_type: "alert"}},
                            {not: {term: {tags: "archived"}}},
                            {range: {timestamp: {gte: alertGroup.oldestTs}}},
                            {range: {timestamp: {lte: alertGroup.newestTs}}},
                            {term: {"alert.signature_id": alertGroup.event._source.alert.signature_id}},
                            {term: {src_ip: alertGroup.event._source.src_ip}},
                            {term: {dest_ip: alertGroup.event._source.dest_ip}}
                        ]
                    }
                }
            },
            _source: options._source || true,
            size: this.defaultBatchSize
        };

        if (options.filters) {
            options.filters.forEach((filter:any) => {
                query.query.filtered.filter.and.push(filter);
            })
        }

        return this.search(query);
    }

    addTagsToEventSet(events:any[], tags:string[]) {

        let bulkUpdates = <any[]>[];

        events.forEach((event:any) => {

            let eventTags:any[] = event._source.tags || [];

            tags.forEach((tag:any) => {
                if (eventTags.indexOf(tag) < 0) {
                    eventTags.push(tag);
                }
            });

            bulkUpdates.push({
                update: {
                    "_index": event._index,
                    "_type": event._type,
                    "_id": event._id
                }
            });
            bulkUpdates.push({
                "doc": {
                    tags: eventTags
                }
            });
        });

        return this.bulk(bulkUpdates);
    }

    removeTagsFromEventSet(events:any[], tags:string[]) {

        let bulkUpdates = <any[]>[];

        events.forEach((event:any) => {

            let eventTags:any[] = event._source.tags || [];

            tags.forEach((tag:any) => {
                let idx = eventTags.indexOf(tag);

                if (idx > -1) {
                    eventTags.splice(idx, 1);
                }
            });

            bulkUpdates.push({
                update: {
                    "_index": event._index,
                    "_type": event._type,
                    "_id": event._id
                }
            });
            bulkUpdates.push({
                "doc": {
                    tags: eventTags
                }
            });
        });

        return this.bulk(bulkUpdates);
    }

    escalateAlertGroup(alertGroup:AlertGroup):Promise<string> {

        return this.submit(() => {
            return this._escalateAlertGroup(alertGroup);
        });

    }

    _escalateAlertGroup(alertGroup:AlertGroup) {

        return new Promise<string>((resolve, reject) => {

            return this.getAlertsInAlertGroup(alertGroup, {
                _source: "tags",
                filters: [{not: {term: {tags: "escalated"}}}]
            }).then((response:any) => {
                if (response.hits.hits.length == 0) {
                    resolve("OK");
                }
                else {
                    return this.addTagsToEventSet(response.hits.hits,
                        ["escalated", "evebox.escalated"])
                        .then(() => {
                            this._escalateAlertGroup(alertGroup)
                                .then(() => resolve("OK"));
                        });
                }
            });

        });

    }

    removeEscalatedStateFromAlertGroup(alertGroup:AlertGroup):Promise<string> {

        return this.submit(() => {
            return this._removeEscalatedStateFromAlertGroup(alertGroup);
        });

    }

    _removeEscalatedStateFromAlertGroup(alertGroup:AlertGroup):Promise<string> {

        return new Promise<string>((resolve, reject) => {

            return this.getAlertsInAlertGroup(alertGroup, {
                _source: "tags",
                filters: [{term: {tags: "escalated"}}],
            }).then((response:any) => {
                if (response.hits.hits.length == 0) {
                    resolve("OK");
                }
                else {
                    return this.removeTagsFromEventSet(response.hits.hits,
                        ["escalated", "evebox.escalated"])
                        .then(() => {
                            this._removeEscalatedStateFromAlertGroup(alertGroup)
                                .then((response:any) => {
                                    resolve("OK");
                                });
                        });
                }
            });

        });

    }

    archiveAlertGroup(alertGroup:AlertGroup) {

        return this.submit(() => {
            return this._archiveAlertGroup(alertGroup);
        });

    }

    _archiveAlertGroup(alertGroup:AlertGroup) {

        let self = this;

        return new Promise<any>((resolve, reject) => {

            (function execute() {

                self.getAlertsInAlertGroup(alertGroup, {_source: "tags"})
                    .then((response:any) => {
                        if (response.hits.hits.length == 0) {
                            console.log("Done archiving events.");
                            resolve();
                        }
                        else {
                            console.log("Archiving events.");
                            self.addTagsToEventSet(response.hits.hits,
                                ["archived", "evebox.archived"])
                                .then((response:any) => {
                                    execute();
                                })
                        }
                    })

            })();

        });

    }

    getEventById(id:string):Promise<any> {
        let query = {
            query: {
                filtered: {
                    filter: {
                        term: {_id: id}
                    }
                }
            }
        };
        return this.search(query).then(response => {
            if (response.hits.hits.length > 0) {
                return response.hits.hits[0];
            }
            else {
                throw "event not found error";
            }
        })
    }

    getAlerts(options?:any):Promise<AlertGroup[]> {

        options = options || {};

        let query:any = {
            query: {
                filtered: {
                    filter: {
                        and: [
                            {exists: {field: "event_type"}},
                            {term: {event_type: "alert"}},
                            {not: {term: {tags: "archived"}}},
                            {range: {timestamp: {gte: "now-1d"}}}
                        ]
                    }
                }
            },
            size: 0,
            sort: [
                {"@timestamp": {order: "desc"}}
            ],
            aggs: {
                signatures: {
                    terms: {
                        field: "alert.signature.raw",
                        size: 0
                    },
                    aggs: {
                        sources: {
                            terms: {
                                field: "src_ip.raw",
                                size: 0
                            },
                            aggs: {
                                destinations: {
                                    terms: {
                                        field: "dest_ip.raw",
                                        size: 0
                                    },
                                    aggs: {
                                        newest: {
                                            top_hits: {
                                                sort: [{"@timestamp": {order: "desc"}}],
                                                size: 1
                                            }
                                        },
                                        oldest: {
                                            top_hits: {
                                                sort: [
                                                    {"@timestamp": {order: "asc"}}
                                                ],
                                                size: 1
                                            }
                                        },
                                        escalated: {
                                            filter: {term: {tags: "escalated"}}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            timeout: 1000
        };

        if (options.queryString) {
            console.log("Setting query string to: " + options.queryString);
            query.query.filtered.query = {
                query_string: {
                    query: options.queryString
                }
            }
        }

        function unwrapResponse(response:any):AlertGroup[] {

            let events:AlertGroup[] = [];

            // Unwrap from the buckets.
            response.aggregations.signatures.buckets.forEach((sig:any) => {
                sig.sources.buckets.forEach((source:any) => {
                    source.destinations.buckets.forEach((dest:any) => {

                        let event = {

                            // Total number of events in group.
                            count: <number>dest.doc_count,

                            // Number of escalated events.
                            escalatedCount: <number>dest.escalated.doc_count,

                            // The newest (most recent timestamp).
                            newestTs: <string>dest.newest.hits.hits[0]._source.timestamp,

                            // The oldest timestampa.
                            oldestTs: <string>dest.oldest.hits.hits[0]._source.timestamp,

                            // The newest occurrence of the event.
                            event: <any>dest.newest.hits.hits[0]

                        };

                        events.push(event);

                    })
                })
            });

            // Sort.
            events.sort((a, b) => {
                let x = moment(a.newestTs);
                let y = moment(b.newestTs);
                return y.diff(x);
            });

            return events;

        }

        return this.search(query).then(response => unwrapResponse(response));
    }
}