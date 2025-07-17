import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import QRCode from 'qrcode';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-qr-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './qr-generator.component.html',
  styleUrls: ['./generate-qr.component.css']
})
export class QrGeneratorComponent {
  qrForm: FormGroup;
  qrImage: SafeUrl | null = null;
  qrData: string | null = null;
  showCustomInput = false;
  uploadedLogo: File | null = null;
  showAdvancedOptions = false;
  downloadOptions = {
    format: 'png',
    quality: 1.0
  };
  shareSupported = false;
  copied = false;
  shapeOptions = [
    { value: 'square', label: 'Square', icon: '■' },
    { value: 'circle', label: 'Circle', icon: '●' },
    { value: 'rounded', label: 'Rounded', icon: '▢' },
    { value: 'star', label: 'Star', icon: '★' },
    { value: 'diamond', label: 'Diamond', icon: '◆' }
  ];

  constructor(
    private fb: FormBuilder,
    private sanitizer: DomSanitizer
  ) {
    this.qrForm = this.fb.group({
      format: ['CSV', Validators.required],
      chargeBoxId: ['', Validators.required],
      evseId: [''],
      connectorId: [''],
      resolution: ['200', Validators.required],
      customResolution: [''],
      qrColor: ['#000000'],
      bgColor: ['#ffffff'],
      margin: [2, [Validators.min(0), Validators.max(10)]],
      errorCorrection: ['M'],
      shapeType: ['square']
    });

    this.shareSupported = navigator.share !== undefined;
  }

  toggleCustomInput(): void {
    const resolution = this.qrForm.get('resolution')?.value;
    this.showCustomInput = resolution === 'custom';
  }

  toggleAdvancedOptions(): void {
    this.showAdvancedOptions = !this.showAdvancedOptions;
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

      // Generate QR code data (array of modules)
      const qrCode = await QRCode.create(qrData, {
        errorCorrectionLevel: formValue.errorCorrection
      });

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context not available");

      // Draw QR code with custom shapes
      this.drawCustomQR(ctx, qrCode, finalResolution, formValue);

      // Add logo if uploaded
      if (this.uploadedLogo) {
        await this.addLogoToQR(ctx, canvas, finalResolution);
      }

      this.qrImage = this.sanitizer.bypassSecurityTrustUrl(canvas.toDataURL(`image/${this.downloadOptions.format}`, this.downloadOptions.quality));
      this.qrData = qrData;
    } catch (err) {
      console.error("QR generation failed:", err);
      alert("QR generation failed. Please check the console for details.");
    }
  }

  private drawCustomQR(
    ctx: CanvasRenderingContext2D,
    qrCode: QRCode.QRCode,
    size: number,
    options: any
  ): void {
    const moduleCount = qrCode.modules.size;
    const moduleSize = size / (moduleCount + 2 * options.margin);
    const offset = options.margin * moduleSize;

    ctx.fillStyle = options.bgColor;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = options.qrColor;

    for (let y = 0; y < moduleCount; y++) {
      for (let x = 0; x < moduleCount; x++) {
        if (qrCode.modules.get(x, y)) {
          const xPos = offset + x * moduleSize;
          const yPos = offset + y * moduleSize;

          switch (options.shapeType) {
            case 'circle':
              this.drawCircle(ctx, xPos, yPos, moduleSize);
              break;
            case 'rounded':
              this.drawRoundedSquare(ctx, xPos, yPos, moduleSize, moduleSize / 4);
              break;
            case 'star':
              this.drawStar(ctx, xPos, yPos, moduleSize);
              break;
            case 'diamond':
              this.drawDiamond(ctx, xPos, yPos, moduleSize);
              break;
            default: // square
              ctx.fillRect(xPos, yPos, moduleSize, moduleSize);
          }
        }
      }
    }
  }

  private drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRoundedSquare(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + size - radius, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
    ctx.lineTo(x + size, y + size - radius);
    ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
    ctx.lineTo(x + radius, y + size);
    ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  private drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const spikes = 5;
    const outerRadius = size / 2;
    const innerRadius = outerRadius / 2;
    const cx = x + outerRadius;
    const cy = y + outerRadius;
    let rot = Math.PI / 2 * 3;
    let xPos = cx;
    let yPos = cy - outerRadius;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      xPos = cx + Math.cos(rot) * outerRadius;
      yPos = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(xPos, yPos);
      rot += step;

      xPos = cx + Math.cos(rot) * innerRadius;
      yPos = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(xPos, yPos);
      rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  private drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const halfSize = size / 2;
    ctx.beginPath();
    ctx.moveTo(x + halfSize, y);
    ctx.lineTo(x + size, y + halfSize);
    ctx.lineTo(x + halfSize, y + size);
    ctx.lineTo(x, y + halfSize);
    ctx.closePath();
    ctx.fill();
  }

  private async addLogoToQR(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, resolution: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.uploadedLogo) {
        resolve();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const logo = new Image();
        logo.src = reader.result as string;
        logo.onload = () => {
          this.drawLogoOnQR(ctx, logo, resolution, canvas);
          resolve();
        };
        logo.onerror = () => {
          console.warn("Failed to load uploaded logo. Proceeding without logo.");
          resolve();
        };
      };
      reader.onerror = () => {
        console.warn("Failed to read uploaded logo. Proceeding without logo.");
        resolve();
      };
      reader.readAsDataURL(this.uploadedLogo);
    });
  }

  private drawLogoOnQR(
    ctx: CanvasRenderingContext2D,
    logo: HTMLImageElement,
    resolution: number,
    canvas: HTMLCanvasElement
  ): void {
    const imgSize = resolution * 0.24;
    const x = (resolution - imgSize) / 2;
    const y = (resolution - imgSize) / 2;
    const cornerRadius = imgSize * 0.15;

    ctx.fillStyle = this.qrForm.value.bgColor || '#ffffff';
    ctx.beginPath();
    this.drawRoundedRect(ctx, x, y, imgSize, imgSize, cornerRadius);
    ctx.fill();

    ctx.drawImage(logo, x, y, imgSize, imgSize);
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

  downloadQR(): void {
    if (!this.qrImage) return;
    
    const link = document.createElement('a');
    link.href = this.qrImage.toString();
    link.download = `qr-code.${this.downloadOptions.format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async shareQR(): Promise<void> {
    if (!this.qrImage || !this.shareSupported) return;
    
    try {
      const response = await fetch(this.qrImage.toString());
      const blob = await response.blob();
      const file = new File([blob], 'qr-code.png', { type: blob.type });
      
      await navigator.share({
        title: 'Generated QR Code',
        text: 'Check out this QR code I generated!',
        files: [file]
      });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  }

  copyQRData(): void {
    if (!this.qrData) return;
    
    navigator.clipboard.writeText(this.qrData).then(() => {
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    });
  }

  setDownloadFormat(format: string): void {
    this.downloadOptions.format = format;
  }
}