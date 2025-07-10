import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qr-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './qr-generator.component.html',
  styleUrls: ['./generate-qr.component.css']
})
export class QrGeneratorComponent {
  qrForm: FormGroup;
  qrImage: string | null = null;
  qrData: string | null = null;
  showCustomInput = false;

  constructor(private fb: FormBuilder) {
    this.qrForm = this.fb.group({
      format: ['CSV', Validators.required],
      chargeBoxId: ['', Validators.required],
      evseId: [''],
      connectorId: [''],
      resolution: ['200', Validators.required],
      customResolution: ['']
    });
  }

  toggleCustomInput(): void {
    const resolution = this.qrForm.get('resolution')?.value;
    this.showCustomInput = resolution === 'custom';
  }

  async onSubmit(): Promise<void> {
    if (this.qrForm.invalid) return;

    const formValue = this.qrForm.value;

    if (formValue.connectorId && !formValue.evseId) {
      alert("To use Connector ID, you must also provide EVSE ID.");
      return;
    }

    let finalResolution = parseInt(formValue.resolution);
    if (formValue.resolution === 'custom') {
      finalResolution = parseInt(formValue.customResolution);
      if (isNaN(finalResolution) || finalResolution <= 0) {
        alert("Please provide a valid custom resolution.");
        return;
      }
    }

    let qrData = '';

    if (formValue.format === 'CSV') {
      qrData = `OCPQR011.0,${formValue.chargeBoxId},${formValue.evseId || ''},${formValue.connectorId || ''}`;
    } else if (formValue.format === 'JSON') {
      const jsonData = {
        f0: '1.0',
        f1: formValue.chargeBoxId,
        f2: formValue.evseId || '',
        f3: formValue.connectorId || ''
      };
      qrData = `OCPQR02${JSON.stringify(jsonData)}`;
    } else {
      alert("Invalid format.");
      return;
    }

    try {
      this.qrImage = await QRCode.toDataURL(qrData, {
        width: finalResolution,
        margin: 2,
        color: {
          dark: '#000000',  // QR code color
          light: '#ffffff' // Background color
        }
      });
      this.qrData = qrData;
    } catch (err) {
      console.error("QR generation failed:", err);
      alert("QR generation failed. Please check the console for details.");
    }
  }
}