import { TestBed } from '@angular/core/testing';

import { QuixService } from './quix.service';

describe('QuixServiceTsService', () => {
  let service: QuixService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuixService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
