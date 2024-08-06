import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, IHttpConnectionOptions } from '@microsoft/signalr';
import { combineLatest, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { EventData } from '../models/eventData';
import { ParameterData } from '../models/parameterPayload';

export enum ConnectionStatus {
	Connected = 'Connected',
	Reconnecting = 'Reconnecting',
	Offline = 'Offline'
}

@Injectable({
	providedIn: 'root'
})
export class QuixService {
	// this is the token that will authenticate the user into the ungated product experience.
	// ungated means no password or login is needed.
	// the token is locked down to the max and everything is read only.
	public ungatedToken: string = 'pat-f8339e65ca3e499b8775026991c72240';

	/*~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-*/
	/*WORKING LOCALLY? UPDATE THESE!*/
	private token: string = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlpXeUJqWTgzcXotZW1pUlZDd1I4dyJ9.eyJodHRwczovL3F1aXguYWkvcm9sZXMiOiJhZG1pbiIsImh0dHBzOi8vcXVpeC5haS9vcmdfaWQiOiJxdWl4ZGV2IiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmRldi5xdWl4LmFpLyIsInN1YiI6ImF1dGgwfDIxOTFlNGI2LWM3NDAtNGVlMi05Zjk1LWExMTVkMjcwYTVjMCIsImF1ZCI6WyJodHRwczovL3BvcnRhbC1hcGkuZGV2LnF1aXguYWkvIiwiaHR0cHM6Ly9xdWl4LWRldi5ldS5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNzIyODk1NjAxLCJleHAiOjE3MjU0ODc2MDEsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwiLCJhenAiOiI2MDRBOXE1Vm9jWW92b05Qb01panVlVVpjRUhJY2xNcyIsInBlcm1pc3Npb25zIjpbXX0.q9apYTaVS7ftBWwTjm81m-xVCFhD2fJ0BXH1ZST-DN5uRQlJhV1CLnKZotuBBTVRVGXCX4FG1i6o-EaaYnTHQuefTRcqi4IB8FEJYuCPIIPw7RR3yk6_op4X1Gq7MHgDq_nJlnURK7N8t2mrW9AywXKtkPyXvr9oIoW-dBbGxpjnQkCrzpNDtX-IhTov6d6P-EpOjEeJkm1Ny9VrzaT7z7hHNetAxC1IfNXzIlgVPurf7xsUi-8T1DzeldklyWtmRcy2oe-mU2bJS3jvuIl5t3oSk5hr05XohrrRJpsZ_PYL_CJCqufXw7SUrQoEJUWEOvzbzw55P2PEtZpGT8asZQ'; // Create a token in the Tokens menu and paste it here
	private workingLocally = true; // set to true if working locally

	public workspaceId: string = 'quixdev-quixcoinmarket-develop'; // Look in the URL for the Quix Portal your workspace ID is after 'workspace='
	public coinDataTopic: string = 'coin-data-updated'; // get topic name from the Topics page
	/*~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-*/

	private subdomain = 'dev'; // leave as 'platform'
	readonly server = ''; // leave blank

	private readerReconnectAttempts: number = 0;
	private writerReconnectAttempts: number = 0;
	private reconnectInterval: number = 5000;
	private hasReaderHubListeners: boolean = false;

	public readerHubConnection: HubConnection;
	public writerHubConnection: HubConnection;

	private readerConnStatusChanged = new Subject<ConnectionStatus>();
	readerConnStatusChanged$ = this.readerConnStatusChanged.asObservable();
	private writerConnStatusChanged = new Subject<ConnectionStatus>();
	writerConnStatusChanged$ = this.writerConnStatusChanged.asObservable();

	paramDataReceived = new Subject<ParameterData>();
	paramDataReceived$ = this.paramDataReceived.asObservable();

	eventDataReceived = new Subject<EventData>();
	eventDataReceived$ = this.eventDataReceived.asObservable();

	private domainRegex = new RegExp('^https:\\/\\/portal-api\\.([a-zA-Z]+)\\.quix\\.ai');

	constructor(private httpClient: HttpClient) {
		if (this.workingLocally) {
			this.coinDataTopic = this.workspaceId + '-' + this.coinDataTopic;
			this.setUpHubConnections(this.workspaceId);
		} else {
			const headers = new HttpHeaders().set('Content-Type', 'text/plain; charset=utf-8');
			let bearerToken$ = this.httpClient.get(this.server + 'bearer_token', {
				headers,
				responseType: 'text'
			});
			let workspaceId$ = this.httpClient.get(this.server + 'workspace_id', { headers, responseType: 'text' });
			let coinDataTopic$ = this.httpClient.get(this.server + 'coin_data_topic', { headers, responseType: 'text' });
			let portalApi$ = this.httpClient.get(this.server + 'portal_api', {
				headers,
				responseType: 'text'
			});

			let value$ = combineLatest([
				// General
				bearerToken$,
				workspaceId$,
				portalApi$,

				// Topics
				coinDataTopic$
			]).pipe(
				map(([bearerToken, workspaceId, portalApi, coinDataTopic]) => {
					return {
						bearerToken,
						workspaceId,
						portalApi,
						coinDataTopic
					};
				})
			);

			value$.subscribe(({ bearerToken, workspaceId, portalApi, coinDataTopic }) => {
				this.token = this.stripLineFeed(bearerToken);
				this.workspaceId = this.stripLineFeed(workspaceId);
				this.coinDataTopic = this.stripLineFeed(this.workspaceId + '-' + coinDataTopic);

				portalApi = portalApi.replace('\n', '');
				let matches = portalApi.match(this.domainRegex);
				if (matches) {
					this.subdomain = matches[1];
				} else {
					this.subdomain = 'dev'; // default to prod
				}

				this.setUpHubConnections(this.workspaceId);
			});
		}
	}

	private setUpHubConnections(workspaceId: string): void {
		const options: IHttpConnectionOptions = {
			accessTokenFactory: () => this.token
		};

		this.readerHubConnection = this.createHubConnection(`https://reader-${workspaceId}.${this.subdomain}.quix.io/hub`, options, true);
		this.startConnection(true, this.readerReconnectAttempts);

		this.writerHubConnection = this.createHubConnection(`https://writer-${workspaceId}.${this.subdomain}.quix.io/hub`, options, false);
		this.startConnection(false, this.writerReconnectAttempts);
	}

	/**
	 * Creates a new hub connection.
	 *
	 * @param url The url of the SignalR connection.
	 * @param options The options for the hub.
	 * @param isReader Whether it's the ReaderHub or WriterHub.
	 *
	 * @returns The newly created hub connection.
	 */
	private createHubConnection(url: string, options: IHttpConnectionOptions, isReader: boolean): HubConnection {
		const hubConnection = new HubConnectionBuilder().withUrl(url, options).build();

		const hubName = isReader ? 'Reader' : 'Writer';
		hubConnection.onclose((error) => {
			console.log(`Quix Service - ${hubName} | Connection closed. Reconnecting... `, error);
			this.tryReconnect(isReader, isReader ? this.readerReconnectAttempts : this.writerReconnectAttempts);
		});
		return hubConnection;
	}

	/**
	 * Handles the initial logic of starting the hub connection. If it falls
	 * over in this process then it will attempt to reconnect.
	 *
	 * @param isReader Whether it's the ReaderHub or WriterHub.
	 * @param reconnectAttempts The number of attempts to reconnect.
	 */
	private startConnection(isReader: boolean, reconnectAttempts: number): void {
		const hubConnection = isReader ? this.readerHubConnection : this.writerHubConnection;
		const subject = isReader ? this.readerConnStatusChanged : this.writerConnStatusChanged;
		const hubName = isReader ? 'Reader' : 'Writer';

		if (!hubConnection || hubConnection.state === 'Disconnected') {
			hubConnection
				.start()
				.then(() => {
					console.log(`QuixService - ${hubName} | Connection established!`);
					reconnectAttempts = 0; // Reset reconnect attempts on successful connection
					subject.next(ConnectionStatus.Connected);

					// If it's reader hub connection then we create listeners for data
					if (isReader && !this.hasReaderHubListeners) {
						this.setupReaderHubListeners(hubConnection);
						this.hasReaderHubListeners = true;
					}
				})
				.catch((err) => {
					console.error(`QuixService - ${hubName} | Error while starting connection!`, err);
					subject.next(ConnectionStatus.Reconnecting);
					this.tryReconnect(isReader, reconnectAttempts);
				});
		}
	}

	/**
	 * Creates listeners on the ReaderHub connection for both parameters
	 * and events so that we can detect when something changes. This can then
	 * be emitted to any components listening.
	 *
	 * @param readerHubConnection The readerHubConnection we are listening to.
	 */
	private setupReaderHubListeners(readerHubConnection: HubConnection): void {
		// Listen for parameter data and emit
		readerHubConnection.on('ParameterDataReceived', (payload: ParameterData) => {
			this.paramDataReceived.next(payload);
		});

		// Listen for event data and emit
		readerHubConnection.on('EventDataReceived', (payload: EventData) => {
			this.eventDataReceived.next(payload);
		});
	}

	/**
	 * Handles the reconnection for a hub connection. Will continiously
	 * attempt to reconnect to the hub when the connection drops out. It does
	 * so with a timer of 5 seconds to prevent a spam of requests and gives it a
	 * chance to reconnect.
	 *
	 * @param isReader Whether it's the ReaderHub or WriterHub.
	 * @param reconnectAttempts The number of attempts to reconnect.
	 */
	private tryReconnect(isReader: boolean, reconnectAttempts: number) {
		const hubName = isReader ? 'Reader' : 'Writer';
		reconnectAttempts++;
		setTimeout(() => {
			console.log(`QuixService - ${hubName} | Attempting reconnection... (${reconnectAttempts})`);
			this.startConnection(isReader, reconnectAttempts);
		}, this.reconnectInterval);
	}

	/**
	 * Subscribes to a parameter on the ReaderHub connection so
	 * we can listen to changes.
	 *
	 * @param topic The topic being wrote to.
	 * @param streamId The id of the stream.
	 * @param parameterId The parameter want to listen for changes.
	 */
	public subscribeToParameter(topic: string, streamId: string, parameterId: string) {
		// console.log(`QuixService Reader | Subscribing to parameter - ${topic}, ${streamId}, ${parameterId}`);
		this.readerHubConnection.invoke('SubscribeToParameter', topic, streamId, parameterId);
	}

	/**
	 * Unsubscribe from a parameter on the ReaderHub connection
	 * so we no longer recieve changes.
	 *
	 * @param topic
	 * @param streamId
	 * @param parameterId
	 */
	public unsubscribeFromParameter(topic: string, streamId: string, parameterId: string) {
		// console.log(`QuixService Reader | Unsubscribing from parameter - ${topic}, ${streamId}, ${parameterId}`);
		this.readerHubConnection.invoke('UnsubscribeFromParameter', topic, streamId, parameterId);
	}

	/**
	 * Sends parameter data to Quix using the WriterHub connection.
	 *
	 * @param topic The name of the topic we are writing to.
	 * @param streamId The id of the stream.
	 * @param payload The payload of data we are sending.
	 */
	public sendParameterData(topic: string, streamId: string, payload: any): void {
		// console.log("QuixService Sending parameter data!", topic, streamId, payload);
		this.writerHubConnection.invoke('SendParameterData', topic, streamId, payload);
	}

	/**
	 * Uses the telemetry data api to retrieve persisted parameter
	 * data for a specific criteria.
	 *
	 * @param payload The payload that we are querying with.
	 * @returns The persisted parameter data.
	 */
	public retrievePersistedParameterData(payload: any): Observable<ParameterData> {
		return this.httpClient.post<ParameterData>(`https://telemetry-query-${this.workspaceId}.${this.subdomain}.quix.ai/parameters/data`, payload, {
			headers: { Authorization: 'bearer ' + this.token }
		});
	}

	private stripLineFeed(s: string): string {
		return s.replace('\n', '');
	}
}
