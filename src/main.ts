import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { QrGeneratorComponent } from './app/qr-generator.component';

bootstrapApplication(QrGeneratorComponent)
  .catch(err => console.error(err));
