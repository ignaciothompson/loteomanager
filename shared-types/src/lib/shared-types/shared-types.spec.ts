import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTypes } from './shared-types';

describe('SharedTypes', () => {
  let component: SharedTypes;
  let fixture: ComponentFixture<SharedTypes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedTypes]
    }).compileComponents();

    fixture = TestBed.createComponent(SharedTypes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
