import { Component, OnDestroy } from '@angular/core';
import { ConnectionStatus, QuixService } from './services/quix.service';
import { filter, Subject, take, takeUntil } from 'rxjs';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {
	title = 'marketcap';

  connectionState = ConnectionStatus;
	readerConnectionStatus: ConnectionStatus = ConnectionStatus.Offline;
	writerConnectionStatus: ConnectionStatus = ConnectionStatus.Offline;

  private unsubscribe$ = new Subject<void>();

	constructor(private quixService: QuixService) {
		// Listen for connection status changes
		this.quixService.readerConnStatusChanged$.pipe(takeUntil(this.unsubscribe$)).subscribe((status) => {
      console.log('readerConnectionStatus', status);
			this.readerConnectionStatus = status;
		});
		this.quixService.writerConnStatusChanged$.pipe(takeUntil(this.unsubscribe$)).subscribe((status) => {
      console.log('writerConnectionStatus', status);
			this.writerConnectionStatus = status;
		});

    this.quixService.readerConnStatusChanged$.pipe(filter((f) => f === this.connectionState.Connected), take(1)).subscribe(() => {
      this.quixService.subscribeToParameter(this.quixService.coinDataTopic, '*', '*');
    })

    // Listen for reader messages
    this.quixService.paramDataReceived$
      .pipe(
        takeUntil(this.unsubscribe$),
        //filter((f) => f.streamId === this.roomService.selectedRoom) // Ensure there is no message leaks
      )
      .subscribe((payload) => {
        console.log('PAYLOAD RECIEVED', payload);
      });
	}

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

}
