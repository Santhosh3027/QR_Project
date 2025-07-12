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
  uploadedLogo: File | null = null;

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

  onLogoSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files && fileInput.files.length > 0) {
      this.uploadedLogo = fileInput.files[0];
    }
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
      qrData = `OCPQR011.0,${formValue.chargeBoxId}`;
      if (formValue.evseId) {
        qrData += `,${formValue.evseId}`;
        if (formValue.connectorId) {
          qrData += `,${formValue.connectorId}`;
        }
      }
    } else if (formValue.format === 'JSON') {
      const jsonData: any = {
        f0: '1.0',
        f1: formValue.chargeBoxId,
      };
      if (formValue.evseId) jsonData.f2 = formValue.evseId;
      if (formValue.connectorId) jsonData.f3 = formValue.connectorId;
      qrData = `OCPQR02${JSON.stringify(jsonData)}`;
    } else {
      alert("Invalid format.");
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = finalResolution;

      await QRCode.toCanvas(canvas, qrData, {
        width: finalResolution,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context not available");

      const logo = new Image();

      const drawLogo = (src: string) => {
        logo.src = src;
        logo.onload = () => {
          this.drawLogoOnQR(ctx, logo, finalResolution, canvas, qrData);
        };
        logo.onerror = () => {
          alert("Error loading logo image.");
        };
      };

      if (this.uploadedLogo) {
        const reader = new FileReader();
        reader.onload = () => {
          drawLogo(reader.result as string);
        };
        reader.readAsDataURL(this.uploadedLogo);
      } else {
        drawLogo('assets/images.png');
      }

    } catch (err) {
      console.error("QR generation failed:", err);
      alert("QR generation failed. Please check the console for details.");
    }
  }

  private drawLogoOnQR(
    ctx: CanvasRenderingContext2D,
    logo: HTMLImageElement,
    resolution: number,
    canvas: HTMLCanvasElement,
    qrData: string
  ): void {
    const imgSize = resolution * 0.24;
    const x = (resolution - imgSize) / 2;
    const y = (resolution - imgSize) / 2;
    const cornerRadius = imgSize * 0.15;

    ctx.fillStyle = 'white';
    ctx.beginPath();
    this.drawRoundedRect(ctx, x, y, imgSize, imgSize, cornerRadius);
    ctx.fill();

    ctx.drawImage(logo, x, y, imgSize, imgSize);

    this.qrImage = canvas.toDataURL();
    this.qrData = qrData;
  }

  private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
