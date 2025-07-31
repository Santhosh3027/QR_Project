import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import QRCode from 'qrcode';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';
import jsQR from 'jsqr';

interface ShapeOption {
  value: string;
  label: string;
  icon: string;
}

interface DecodedData {
  chargeBoxId?: string;
  evseId?: string;
  connectorId?: string;
  format?: string;
  raw?: string;
}

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
  uploadedBackground: File | null = null;
  showAdvancedOptions = false;
  showDecoder = false;
  decodedData: DecodedData | null = null;
  downloadOptions = {
    format: 'png',
    quality: 1.0
  };
  shareSupported = false;
  copied = false;
  showModal = false;
  modalMessage = '';
  modalTitle = 'Validation Required';
  private previousQrColor = '#000000';

  shapeOptions: ShapeOption[] = [
    { value: 'square', label: 'Square', icon: '■' },
    { value: 'circle', label: 'Circle', icon: '●' },
    { value: 'rounded', label: 'Rounded', icon: '▢' },
    { value: 'star', label: 'Star', icon: '★' },
    { value: 'diamond', label: 'Diamond', icon: '◆' },
    { value: 'triangle', label: 'Triangle', icon: '▲' },
    { value: 'dot', label: 'Dot', icon: '•' },
    { value: 'heart', label: 'Heart', icon: '❤' }
  ];

  constructor(private fb: FormBuilder, private sanitizer: DomSanitizer) {
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
      shapeType: ['square'],
      logoSize: [15, [Validators.min(5), Validators.max(40)]],
      bgOpacity: [0.5, [Validators.min(0.1), Validators.max(1)]],
      squaresColor: ['#000000'],
      pixelsColor: ['#000000']
    });

    this.shareSupported = navigator.share !== undefined;

    this.qrForm.get('logoSize')?.valueChanges.subscribe(() => {
      if (this.qrData) this.onSubmit();
    });

    this.qrForm.get('bgOpacity')?.valueChanges.subscribe(() => {
      if (this.qrData) this.onSubmit();
    });
  }

  // Modal Methods
  openModal(title: string, message: string): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  // Form Toggle Methods
  toggleCustomInput(): void {
    const resolution = this.qrForm.get('resolution')?.value;
    this.showCustomInput = resolution === 'custom';
  }

  toggleAdvancedOptions(): void {
    this.showAdvancedOptions = !this.showAdvancedOptions;
  }

  toggleDecoder(): void {
    this.showDecoder = !this.showDecoder;
    if (!this.showDecoder) {
      this.decodedData = null;
    }
  }

  // File Handling Methods
  onLogoSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files?.length) {
      this.uploadedLogo = fileInput.files[0];
      if (this.qrData) this.onSubmit();
    }
  }

  onBackgroundSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files?.length) {
      this.uploadedBackground = fileInput.files[0];
      if (this.qrData) this.onSubmit();
    }
  }

  async onQRUpload(event: Event): Promise<void> {
    const fileInput = event.target as HTMLInputElement;
    if (!fileInput.files?.length) return;

    try {
      const file = fileInput.files[0];
      const text = await this.readQRCode(file);
      this.parseQRData(text);
    } catch (error) {
      console.error('QR decoding failed:', error);
      this.openModal('Decoding Error', 'Failed to decode QR code. Please try another image.');
    }
  }

  // Form Adjustment Methods
  adjustLogoSize(change: number): void {
    const size = this.qrForm.get('logoSize')?.value;
    const newSize = size + change;
    if (newSize >= 5 && newSize <= 40) {
      this.qrForm.patchValue({ logoSize: newSize });
    }
  }

  adjustBgOpacity(change: number): void {
    const opacity = this.qrForm.get('bgOpacity')?.value;
    const newOpacity = +(opacity + change).toFixed(2);
    if (newOpacity >= 0.1 && newOpacity <= 1) {
      this.qrForm.patchValue({ bgOpacity: newOpacity });
    }
  }

  onQrColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newColor = input.value;
    
    this.qrForm.patchValue({
      qrColor: newColor,
      squaresColor: newColor,
      pixelsColor: newColor
    });
    
    this.previousQrColor = newColor;
    
    if (this.qrData) {
      this.onSubmit();
    }
  }

  removeLogo(): void {
    this.uploadedLogo = null;
    if (this.qrData) {
      this.onSubmit();
    }
  }

  // QR Generation Methods
  async onSubmit(): Promise<void> {
    if (!this.qrForm.get('chargeBoxId')?.value) {
      this.openModal('Validation Error', 'Charge Box ID is required.');
      return;
    }

    if (this.qrForm.invalid) {
      this.openModal('Validation Error', 'Please fill in all required fields.');
      return;
    }

    const form = this.qrForm.value;

    if (form.connectorId && !form.evseId) {
      this.openModal('Validation Error', 'Connector ID requires EVSE ID.');
      return;
    }

    let resolution = parseInt(form.resolution);
    if (form.resolution === 'custom') {
      resolution = parseInt(form.customResolution);
      if (isNaN(resolution) || resolution < 100 || resolution > 1000) {
        this.openModal('Invalid Resolution', 'Resolution must be between 100 and 1000.');
        return;
      }
    }

    let qrData = '';
    if (form.format === 'CSV') {
      qrData = `OCPQR011.0,${form.chargeBoxId}`;
      if (form.evseId) {
        qrData += `,${form.evseId}`;
        if (form.connectorId) {
          qrData += `,${form.connectorId}`;
        }
      }
    } else if (form.format === 'JSON') {
      const jsonData: any = {
        f0: '1.0',
        f1: form.chargeBoxId
      };
      if (form.evseId) jsonData.f2 = form.evseId;
      if (form.connectorId) jsonData.f3 = form.connectorId;
      qrData = `OCPQR02${JSON.stringify(jsonData)}`;
    } else {
      this.openModal('Invalid Format', 'Format must be CSV or JSON.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = resolution;
      const qrCode = await QRCode.create(qrData, { errorCorrectionLevel: form.errorCorrection });
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not found');
      
      await this.drawCustomQR(ctx, qrCode, resolution, form);
      
      if (this.uploadedLogo) {
        await this.addLogoToQR(ctx, canvas, resolution);
      }

      this.qrImage = this.sanitizer.bypassSecurityTrustUrl(canvas.toDataURL(`image/${this.downloadOptions.format}`, this.downloadOptions.quality));
      this.qrData = qrData;
    } catch (error) {
      console.error('QR generation failed:', error);
      this.openModal('Generation Error', 'QR code generation failed.');
    }
  }

  // QR Drawing Methods
  private async drawCustomQR(ctx: CanvasRenderingContext2D, qrCode: QRCode.QRCode, size: number, options: any): Promise<void> {
    const moduleCount = qrCode.modules.size;
    const moduleSize = size / (moduleCount + 2 * options.margin);
    const offset = options.margin * moduleSize;

    await this.drawBackground(ctx, size, options);

    for (let y = 0; y < moduleCount; y++) {
      for (let x = 0; x < moduleCount; x++) {
        if (qrCode.modules.get(x, y)) {
          const xPos = offset + x * moduleSize;
          const yPos = offset + y * moduleSize;
          
          if (this.isPositionPattern(x, y, moduleCount) || 
              this.isAlignmentPattern(x, y, qrCode.version) ||
              this.isTimingPattern(x, y, moduleCount)) {
            ctx.fillStyle = options.squaresColor;
          } else {
            ctx.fillStyle = options.pixelsColor;
          }
          
          this.drawModule(ctx, xPos, yPos, moduleSize, options.shapeType);
        }
      }
    }
  }

  private isPositionPattern(x: number, y: number, moduleCount: number): boolean {
    return (x < 7 && y < 7) || 
           (x > moduleCount - 8 && y < 7) || 
           (x < 7 && y > moduleCount - 8);
  }

  private isAlignmentPattern(x: number, y: number, version: number): boolean {
    if (version < 2) return false;
    
    const locations = this.getAlignmentPatternLocations(version);
    return locations.some(loc => {
      return x >= loc.x - 2 && x <= loc.x + 2 && 
             y >= loc.y - 2 && y <= loc.y + 2;
    });
  }

  private isTimingPattern(x: number, y: number, moduleCount: number): boolean {
    return (x === 6 && y >= 8 && y <= moduleCount - 9) || 
           (y === 6 && x >= 8 && x <= moduleCount - 9);
  }

  private getAlignmentPatternLocations(version: number): {x: number, y: number}[] {
    if (version < 2) return [];
    
    const locations = [];
    const step = Math.floor((version * 4 + 12) / 7);
    for (let i = 4; i < version * 4 + 13 - 4; i += step) {
      for (let j = 4; j < version * 4 + 13 - 4; j += step) {
        if (!((i < 9 && j < 9) || 
             (i < 9 && j > version * 4 + 13 - 9) || 
             (i > version * 4 + 13 - 9 && j < 9))) {
          locations.push({x: i, y: j});
        }
      }
    }
    return locations;
  }

  private async drawBackground(ctx: CanvasRenderingContext2D, size: number, options: any): Promise<void> {
    if (this.uploadedBackground) {
      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            ctx.globalAlpha = options.bgOpacity;
            ctx.drawImage(img, 0, 0, size, size);
            ctx.globalAlpha = 1.0;
            resolve(null);
          };
          img.onerror = () => resolve(null);
          img.src = reader.result as string;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(this.uploadedBackground!);
      });
    } else {
      ctx.fillStyle = options.bgColor;
      ctx.fillRect(0, 0, size, size);
    }
  }

  private drawModule(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, shape: string): void {
    switch (shape) {
      case 'circle': return this.drawCircle(ctx, x, y, size);
      case 'rounded': return this.drawRoundedSquare(ctx, x, y, size, size / 4);
      case 'star': return this.drawStar(ctx, x, y, size);
      case 'diamond': return this.drawDiamond(ctx, x, y, size);
      case 'triangle': return this.drawTriangle(ctx, x, y, size);
      case 'dot': return this.drawDot(ctx, x, y, size);
      case 'heart': return this.drawHeart(ctx, x, y, size);
      default: ctx.fillRect(x, y, size, size);
    }
  }

  private drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRoundedSquare(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + size - r, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + r);
    ctx.lineTo(x + size, y + size - r);
    ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
    ctx.lineTo(x + r, y + size);
    ctx.quadraticCurveTo(x, y + size, x, y + size - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  private drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const spikes = 5, outer = size / 2, inner = outer * 0.5, cx = x + outer, cy = y + outer;
    let rot = Math.PI / 2 * 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outer);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
      rot += Math.PI / spikes;
      ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
      rot += Math.PI / spikes;
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const h = size / 2;
    ctx.beginPath();
    ctx.moveTo(x + h, y);
    ctx.lineTo(x + size, y + h);
    ctx.lineTo(x + h, y + size);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
  }

  private drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x, y + size);
    ctx.closePath();
    ctx.fill();
  }

  private drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const r = size * 0.35;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const s = size * 0.9, ox = x + size / 2, oy = y + size * 0.35;
    ctx.beginPath();
    ctx.moveTo(ox, oy + s / 4);
    ctx.bezierCurveTo(ox + s / 2, oy - s / 4, ox + s, oy + s / 2, ox, oy + s);
    ctx.bezierCurveTo(ox - s, oy + s / 2, ox - s / 2, oy - s / 4, ox, oy + s / 4);
    ctx.closePath();
    ctx.fill();
  }

  private async addLogoToQR(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, resolution: number): Promise<void> {
    if (!this.uploadedLogo) return;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const logo = new Image();
        logo.onload = () => {
          try {
            const percent = Math.min(Math.max(this.qrForm.get('logoSize')?.value || 15, 5), 40);
            const logoSize = resolution * (percent / 100);
            const x = (resolution - logoSize) / 2;
            const y = (resolution - logoSize) / 2;

            ctx.fillStyle = this.qrForm.get('bgColor')?.value || '#ffffff';
            this.drawRoundedRect(ctx, x, y, logoSize, logoSize, logoSize * 0.1);
            ctx.fill();

            ctx.save();
            this.drawRoundedRect(ctx, x, y, logoSize, logoSize, logoSize * 0.1);
            ctx.clip();
            ctx.drawImage(logo, x, y, logoSize, logoSize);
            ctx.restore();

            resolve();
          } catch (err) {
            console.error('Error adding logo:', err);
            resolve();
          }
        };
        logo.onerror = () => resolve();
        logo.src = reader.result as string;
      };
      reader.onerror = () => resolve();
      reader.readAsDataURL(this.uploadedLogo!);
    });
  }

  private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // QR Decoding Methods
  private async readQRCode(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = () => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context not available');
            
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code) {
              resolve(code.data);
            } else {
              reject(new Error('No QR code found in image'));
            }
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private parseQRData(text: string): void {
    this.decodedData = { raw: text };
    
    // Try to parse as CSV format (OCPQR011.0,chargeBoxId,evseId,connectorId)
    if (text.startsWith('OCPQR011.0,')) {
      const parts = text.split(',');
      this.decodedData.format = 'CSV';
      this.decodedData.chargeBoxId = parts[1];
      if (parts[2]) this.decodedData.evseId = parts[2];
      if (parts[3]) this.decodedData.connectorId = parts[3];
      return;
    }
    
    // Try to parse as JSON format (OCPQR02{"f0":"1.0","f1":"chargeBoxId",...})
    if (text.startsWith('OCPQR02')) {
      try {
        const json = JSON.parse(text.substring(7));
        this.decodedData.format = 'JSON';
        this.decodedData.chargeBoxId = json.f1;
        if (json.f2) this.decodedData.evseId = json.f2;
        if (json.f3) this.decodedData.connectorId = json.f3;
      } catch (e) {
        console.warn('Failed to parse JSON from QR code');
      }
      return;
    }
    
    // If we get here, it's an unrecognized format
    this.decodedData.format = 'Unknown';
  }

  useDecodedData(): void {
    if (!this.decodedData) return;
    
    this.qrForm.patchValue({
      format: this.decodedData.format === 'JSON' ? 'JSON' : 'CSV',
      chargeBoxId: this.decodedData.chargeBoxId || '',
      evseId: this.decodedData.evseId || '',
      connectorId: this.decodedData.connectorId || ''
    });
    
    this.showDecoder = false;
  }

  // Output Methods
  downloadQR(): void {
    if (!this.qrImage) {
      this.openModal('Download Error', 'No QR code generated.');
      return;
    }

    const url = this.sanitizer.sanitize(SecurityContext.URL, this.qrImage);
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-code-${Date.now()}.${this.downloadOptions.format}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  copyQRData(): void {
    if (!this.qrData) return;
    navigator.clipboard.writeText(this.qrData).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}