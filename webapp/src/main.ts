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

// Polyfills.
import "core-js/es6";
import "reflect-metadata";
require("zone.js/dist/zone");

// Raw imports.
require("!!script!jquery/dist/jquery.min.js");
require("!!script!bootstrap/dist/js/bootstrap.min.js");

// Angular 2
import '@angular/platform-browser';
import '@angular/platform-browser-dynamic';
import '@angular/core';
import '@angular/common';
import '@angular/http';
import '@angular/router';

// RxJS
import 'rxjs';

// CSS imports.
import "bootstrap/dist/css/bootstrap.css";
require("codemirror/lib/codemirror.css");
import "./evebox.scss";

// More Angular 2.
import {platformBrowserDynamic} from "@angular/platform-browser-dynamic";
import {HttpModule} from "@angular/http";
import {RouterModule} from "@angular/router";
import {LocationStrategy, HashLocationStrategy} from "@angular/common";
import {provide, enableProdMode, NgModule} from "@angular/core";
import {BrowserModule} from "@angular/platform-browser";
import {FormsModule} from "@angular/forms";

// Evebox services.
import {ConfigService} from "./config.service";
import {ElasticSearchService} from "./elasticsearch.service";
import {MousetrapService} from "./mousetrap.service";
import {TopNavService} from "./topnav.service";
import {AlertService} from "./alert.service";
import {AppService} from "./app.service";
import {ApiService} from "./api.service";
import {EventServices} from "./eventservices.service";
import {EventService} from "./event.service";
import {ToastrService} from "./toastr.service";
import {ReportsService} from "./reports/reports.service";
import {EveboxSubscriptionService} from "./subscription.service";
import {EveboxHumanizeService} from "./humanize.service";

// EveBox pipes.
import {EveboxFormatIpAddressPipe} from "./pipes/format-ipaddress.pipe";

// EveBox components.
import {AppComponent} from "./app.component";
import {AlertsComponent} from "./alerts.component";
import {EventsComponent} from "./events.component";
import {EventComponent} from "./event.component";
import {DNSReportComponent} from "./reports/dns-report.component";
import {AlertReportComponent} from "./reports/alerts-report.component";
import {NetflowReportComponent} from "./reports/netflow-report.component";
import {FlowReportComponent} from "./reports/flow-report.component";

// Routes.
import {routing, appRoutingProviders} from "./app.routes";

if (process.env.ENV == "production") {
    console.log("Enabling production mode.");
    enableProdMode();
}

@NgModule({
    imports: [
        BrowserModule,
        FormsModule,
        RouterModule,
        HttpModule,
        routing,
    ],
    declarations: [
        AppComponent,
        AlertsComponent,
        EventsComponent,
        EventComponent,

        DNSReportComponent,
        AlertReportComponent,
        NetflowReportComponent,
        FlowReportComponent,
    ],
    providers: [
        // Use hash URLs.
        provide(LocationStrategy, {
            useClass: HashLocationStrategy
        }),

        // Routing.
        appRoutingProviders,

        // Evebox services.
        ConfigService,
        ElasticSearchService,
        MousetrapService,
        TopNavService,
        AlertService,
        AppService,
        ApiService,
        EventServices,
        EventService,
        ToastrService,
        ReportsService,
        EveboxSubscriptionService,
        EveboxHumanizeService,

        // EveBox pipes.
        EveboxFormatIpAddressPipe
    ],
    bootstrap: [
        AppComponent,
    ]
})
export class AppModule {
}

platformBrowserDynamic().bootstrapModule(AppModule);
