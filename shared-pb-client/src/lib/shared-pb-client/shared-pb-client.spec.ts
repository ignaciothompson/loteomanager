import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedPbClient } from './shared-pb-client';

describe('SharedPbClient', () => {
  let component: SharedPbClient;
  let fixture: ComponentFixture<SharedPbClient>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedPbClient]
    }).compileComponents();

    fixture = TestBed.createComponent(SharedPbClient);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
