import { LearnRoutingModule } from './learn-routing.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@sunbird/shared';
import { SuiModule } from 'ng2-semantic-ui/dist';
import { SlickModule } from 'ngx-slick';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  LearnPageComponent, CoursePlayerComponent, CourseConsumptionHeaderComponent,
  CourseConsumptionPageComponent, BatchDetailsComponent, EnrollBatchComponent, CreateBatchComponent,
  UpdateBatchComponent, CarriculumCardComponent
} from './components';
import { CourseConsumptionService, CourseProgressService } from './services';
import { CoreModule } from '@sunbird/core';
import { DiscussionModule } from '@sunbird/discussion';

@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    SuiModule,
    SlickModule,
    FormsModule,
    LearnRoutingModule,
    CoreModule,
    DiscussionModule
  ],
  providers: [CourseConsumptionService, CourseProgressService],
  declarations: [LearnPageComponent, CoursePlayerComponent, CourseConsumptionHeaderComponent,
    CourseConsumptionPageComponent, BatchDetailsComponent, EnrollBatchComponent, CreateBatchComponent,
    UpdateBatchComponent, CarriculumCardComponent]
})
export class LearnModule { }
