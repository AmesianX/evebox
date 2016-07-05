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

import {Component, OnInit, OnDestroy} from "@angular/core";
import {Location} from "@angular/common";
import {ActivatedRoute, Router} from "@angular/router";
import {ElasticSearchService, AlertGroup} from "./elasticsearch.service";
import {EventSeverityToBootstrapClass} from "./pipes/event-severity-to-bootstrap-class.pipe";
import {CodemirrorComponent} from "./codemirror.component";
import {JsonPipe} from "@angular/common";
import {MapToItemsPipe} from "./pipes/maptoitems.pipe";
import {EveBoxGenericPrettyPrinter} from "./pipes/generic-pretty-printer.pipe";
import {EveBoxEventDescriptionPrinterPipe} from "./pipes/eventdescription.pipe";
import {EveboxBase64DecodePipe} from "./pipes/base64decode.pipe";
import {EveboxHexPipe} from "./pipes/hex.pipe";
import {AceEditor} from "./ace-editor.component";
import {ApiService} from "./api.service";
import {SearchLinkComponent} from "./search-link.component";
import {EventServices} from "./eventservices.service";
import {EventService} from "./event.service";
import {MousetrapService} from "./mousetrap.service";

/**
 * Component to show a single event.
 */
@Component({
    template: require("./event.component.html"),
    pipes: [
        EventSeverityToBootstrapClass, JsonPipe, MapToItemsPipe,
        EveBoxGenericPrettyPrinter, EveBoxEventDescriptionPrinterPipe,
        EveboxBase64DecodePipe, EveboxHexPipe
    ],
    directives: [
        CodemirrorComponent,
        AceEditor,
        SearchLinkComponent
    ]
})
export class EventComponent implements OnInit, OnDestroy {

    private eventId:string;
    private alertGroup:AlertGroup;
    private event:any = {};

    constructor(private route:ActivatedRoute,
                private router:Router,
                private elasticSearchService:ElasticSearchService,
                private api:ApiService,
                private eventServices:EventServices,
                private location:Location,
                private eventService:EventService,
                private mousetrap:MousetrapService) {
    }

    ngOnInit() {

        let alertGroup = this.eventService.popAlertGroup();

        this.route.params.subscribe((params:any) => {

            this.eventId = params.id;

            if (alertGroup && this.eventId == alertGroup.event._id) {
                this.alertGroup = alertGroup;
                this.event = this.alertGroup.event;
            }
            else {
                this.refresh();
            }

        });

        this.mousetrap.bind(this, "u", () => this.goBack());
        this.mousetrap.bind(this, "e", () => this.archiveEvent());
        this.mousetrap.bind(this, "f8", () => this.archiveEvent());

    }

    ngOnDestroy() {
        this.mousetrap.unbind(this);
    }

    eventToPcap(what:any) {
        this.api.eventToPcap(what, this.event._source);
    }

    goBack() {
        this.location.back();
    }

    showArchiveButton() {
        return this.event._source.event_type == "alert" &&
            this.event._source.tags.indexOf("archived") == -1;
    }

    sessionSearch() {
        let q = `+alert.signature.raw:"${this.event._source.alert.signature}"`;
        q += ` +src_ip.raw:"${this.event._source.src_ip}"`;
        q += ` +dest_ip.raw:"${this.event._source.dest_ip}"`;

        console.log(q);

        this.router.navigate(["/events"], { queryParams: {
            q: q
        }});
    }
    
    archiveEvent() {
        if (this.alertGroup) {
            this.elasticSearchService.archiveAlertGroup(this.alertGroup);
            this.alertGroup.event._source.tags.push("archived");
        }
        else {
            this.elasticSearchService.archiveEvent(this.event);
        }
        this.location.back();
    }

    refresh() {
        this.elasticSearchService.getEventById(this.eventId)
            .then(
                (response) => {
                    this.event = response;
                });
    }
}