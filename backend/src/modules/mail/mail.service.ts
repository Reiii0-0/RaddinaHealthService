import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { BatchStockItemDto } from '@shared/api-contracts';

export interface PurchaseOrderEmailPayload {
  id: string;
  spNumber: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  supplierAddress: string;
  supplierPhone: string;
  pharmacistId: string;
  pharmacistName: string;
  pharmacistSipaSnapshot: string;
  status: string;
  notes: string | null;
  createdAt: string;
  items: Array<{
    medicineId: string;
    medicineName: string;
    medicineSku: string;
    activeIngredient: string;
    baseUnit: string;
    orderedBaseQty: number;
    estimatedUnitCost: string | null;
  }>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const host = process.env.SMTP_HOST || 'localhost';
    const port = Number(process.env.SMTP_PORT || 1025);
    const user = process.env.SMTP_USER || undefined;
    const pass = process.env.SMTP_PASS || undefined;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  /**
   * Mengirimkan email HTML Surat Pesanan Elektronik (SP-el) resmi ke alamat email Pedagang Besar Farmasi (PBF).
   */
  async sendPurchaseOrderEmail(
    po: PurchaseOrderEmailPayload,
  ): Promise<nodemailer.SentMessageInfo> {
    const formattedDate = new Date(po.createdAt).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    let totalEstimatedCost = 0;
    const itemsHtml = po.items
      .map((item, idx) => {
        const unitCostNum = Number(item.estimatedUnitCost || 0);
        const lineTotal = unitCostNum * item.orderedBaseQty;
        totalEstimatedCost += lineTotal;

        const formattedUnitCost =
          unitCostNum > 0
            ? `Rp ${Math.round(unitCostNum).toLocaleString('id-ID')}`
            : 'Sesuai Kontrak';
        const formattedLineTotal =
          lineTotal > 0
            ? `Rp ${Math.round(lineTotal).toLocaleString('id-ID')}`
            : 'Menunggu Faktur';

        return `
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 10px 12px; font-size: 13px; color: #334155; text-align: center;">${idx + 1}</td>
            <td style="padding: 10px 12px; font-size: 13px; color: #0F172A; font-weight: 600;">
              ${item.medicineName}
              <div style="font-size: 11px; color: #64748B; font-weight: 400;">Zat Aktif: ${item.activeIngredient} | SKU: ${item.medicineSku}</div>
            </td>
            <td style="padding: 10px 12px; font-size: 13px; color: #0F172A; text-align: right; font-family: monospace; font-weight: 600;">
              ${item.orderedBaseQty.toLocaleString('id-ID')} ${item.baseUnit}
            </td>
            <td style="padding: 10px 12px; font-size: 13px; color: #334155; text-align: right; font-family: monospace;">
              ${formattedUnitCost}
            </td>
            <td style="padding: 10px 12px; font-size: 13px; color: #0F172A; text-align: right; font-family: monospace; font-weight: 600;">
              ${formattedLineTotal}
            </td>
          </tr>
        `;
      })
      .join('');

    const formattedTotal =
      totalEstimatedCost > 0
        ? `Rp ${Math.round(totalEstimatedCost).toLocaleString('id-ID')}`
        : 'Sesuai Konfirmasi Faktur PBF';

    const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Surat Pesanan Obat Resmi</title>
</head>
<body style="margin: 0; padding: 24px; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #0F172A;">
  <div style="max-width: 720px; margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #CBD5E1; overflow: hidden;">
    
    <!-- Kop Surat Apotek -->
    <div style="background-color: #0B3B36; color: #ECFDF5; padding: 24px 32px;">
      <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">RADDINA HEALTH SERVICE (RHS)</h1>
      <p style="margin: 0; font-size: 13px; color: #A7F3D0;">Surat Pesanan Elektronik Pengadaan Sediaan Farmasi (SP-el)</p>
    </div>

    <div style="padding: 32px;">
      <!-- Metadata Transaksi SP -->
      <table style="width: 100%; margin-bottom: 24px; font-size: 13px; border-collapse: collapse;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 16px;">
            <div style="color: #64748B; font-size: 11px; text-transform: uppercase; font-weight: 600;">Nomor Surat Pesanan</div>
            <div style="font-size: 16px; font-weight: 700; color: #0B3B36; font-family: monospace; margin-top: 2px;">${po.spNumber}</div>
            <div style="color: #64748B; margin-top: 8px;">Tanggal Terbit: <strong>${formattedDate}</strong></div>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 16px; border-left: 1px solid #E2E8F0;">
            <div style="color: #64748B; font-size: 11px; text-transform: uppercase; font-weight: 600;">Apoteker Penanggung Jawab (APJ)</div>
            <div style="font-size: 14px; font-weight: 700; color: #0F172A; margin-top: 2px;">${po.pharmacistName}</div>
            <div style="color: #0F766E; font-size: 12px; font-family: monospace; font-weight: 600; margin-top: 2px;">SIPA: ${po.pharmacistSipaSnapshot}</div>
          </td>
        </tr>
      </table>

      <!-- Informasi Pemasok PBF -->
      <div style="background-color: #F1F5F9; border-radius: 6px; padding: 14px 18px; margin-bottom: 24px;">
        <div style="font-size: 11px; color: #64748B; text-transform: uppercase; font-weight: 600;">Tujuan Pesanan (PBF)</div>
        <div style="font-size: 15px; font-weight: 700; color: #0F172A; margin-top: 2px;">${po.supplierName}</div>
        <div style="font-size: 12px; color: #475569; margin-top: 4px;">Alamat: ${po.supplierAddress} | Telepon: ${po.supplierPhone}</div>
      </div>

      <!-- Tabel Daftar Item Obat -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #0B3B36; color: #FFFFFF;">
            <th style="padding: 10px 12px; font-size: 12px; text-align: center; width: 40px;">No</th>
            <th style="padding: 10px 12px; font-size: 12px; text-align: left;">Nama Sediaan Farmasi</th>
            <th style="padding: 10px 12px; font-size: 12px; text-align: right; width: 110px;">Jumlah Satuan</th>
            <th style="padding: 10px 12px; font-size: 12px; text-align: right; width: 120px;">Estimasi HPP</th>
            <th style="padding: 10px 12px; font-size: 12px; text-align: right; width: 130px;">Estimasi Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #F8FAFC; border-top: 2px solid #CBD5E1;">
            <td colspan="4" style="padding: 12px; font-size: 13px; font-weight: 700; text-align: right; color: #0F172A;">Total Estimasi Pengadaan:</td>
            <td style="padding: 12px; font-size: 14px; font-weight: 700; text-align: right; color: #0B3B36; font-family: monospace;">${formattedTotal}</td>
          </tr>
        </tfoot>
      </table>

      ${
        po.notes
          ? `<div style="margin-bottom: 24px; padding: 12px 16px; background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; font-size: 12px; color: #92400E;">
              <strong>Catatan Pemesanan:</strong> ${po.notes}
             </div>`
          : ''
      }

      <!-- Pernyataan Kepatuhan Regulasi Kefarmasian -->
      <div style="font-size: 12px; color: #475569; line-height: 1.6; border-top: 1px solid #E2E8F0; padding-top: 16px; margin-top: 20px;">
        Pesanan ini diterbitkan secara sah oleh Apoteker Penanggung Jawab Apotek Raddina Health Service sesuai izin Surat Izin Praktik Apoteker (SIPA) yang tercantum di atas untuk keperluan pelayanan kefarmasian. Mohon konfirmasi ketersediaan barang dan jadwal pengiriman ke kontak apotek.
      </div>

    </div>
  </div>
</body>
</html>
    `;

    const mailOptions: nodemailer.SendMailOptions = {
      from: process.env.SMTP_FROM || 'apotek@raddinahealth.com',
      to: po.supplierEmail,
      subject: `[SP-el Resmi] Surat Pesanan Obat No. ${po.spNumber} - Raddina Health Service`,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email SP-el ${po.spNumber} berhasil dikirim ke ${po.supplierEmail} (MessageId: ${info.messageId})`,
      );
      return info;
    } catch (error) {
      this.logger.error(
        `Gagal mengirimkan email SP-el ${po.spNumber} ke ${po.supplierEmail}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Mengirimkan email HTML peringatan rangkuman batch obat yang mendekati kedaluwarsa (< 90 hari)
   * kepada pihak manajemen apotek (Pemilik atau Apoteker).
   */
  async sendNearExpiryDigestEmail(
    recipientEmail: string,
    batches: BatchStockItemDto[],
  ): Promise<nodemailer.SentMessageInfo> {
    const today = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const rowsHtml = batches
      .map((b, idx) => {
        const days = b.daysUntilExpiry;
        const urgencyColor =
          days <= 30 ? '#EF4444' : days <= 60 ? '#F59E0B' : '#0F766E';
        return `
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 10px 12px; font-size: 12px; text-align: center; color: #475569;">${idx + 1}</td>
            <td style="padding: 10px 12px; font-size: 13px; color: #0F172A; font-weight: 600;">
              ${b.medicineName}
              <div style="font-size: 11px; color: #64748B;">SKU: ${b.medicineSku} | Pemasok: ${b.supplierName}</div>
            </td>
            <td style="padding: 10px 12px; font-size: 13px; color: #334155; font-family: monospace;">${b.batchNumber}</td>
            <td style="padding: 10px 12px; font-size: 13px; color: #0F172A; text-align: center; font-family: monospace;">${b.expiryDate}</td>
            <td style="padding: 10px 12px; font-size: 13px; text-align: center; font-weight: 700; color: ${urgencyColor}; font-family: monospace;">
              ${days} hari
            </td>
            <td style="padding: 10px 12px; font-size: 13px; text-align: right; font-weight: 700; color: #0F172A; font-family: monospace;">
              ${b.currentStock.toLocaleString('id-ID')} ${b.baseUnit}
            </td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Peringatan Batch Mendekati Kedaluwarsa</title>
</head>
<body style="margin: 0; padding: 24px; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #0F172A;">
  <div style="max-width: 760px; margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #CBD5E1; overflow: hidden;">
    <div style="background-color: #B45309; color: #FFFBEB; padding: 20px 28px;">
      <h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700;">Laporan Stok Mendekati Kedaluwarsa (&lt; 90 Hari)</h1>
      <p style="margin: 0; font-size: 12px; color: #FDE68A;">Raddina Health Service | Tanggal Pemeriksaan: ${today}</p>
    </div>

    <div style="padding: 24px 28px;">
      <p style="font-size: 13px; color: #334155; margin-top: 0;">
        Sistem mendeteksi sebanyak <strong>${batches.length} batch obat</strong> yang memiliki masa kedaluwarsa kurang dari 90 hari. Segera prioritaskan penjualan batch tersebut dengan kaidah FEFO di meja kasir atau ajukan retur barang kepada PBF terkait sesuai ketentuan waktu retur.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #0B3B36; color: #FFFFFF;">
            <th style="padding: 10px 12px; font-size: 12px; text-align: center; width: 35px;">No</th>
            <th style="padding: 10px 12px; font-size: 12px; text-align: left;">Nama Obat & Pemasok</th>
            <th style="padding: 10px 12px; font-size: 12px; text-align: left; width: 110px;">Nomor Batch</th>
            <th style="padding: 10px 12px; font-size: 12px; text-align: center; width: 95px;">Tgl ED</th>
            <th style="padding: 10px 12px; font-size: 12px; text-align: center; width: 85px;">Sisa Waktu</th>
            <th style="padding: 10px 12px; font-size: 12px; text-align: right; width: 95px;">Sisa Stok</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div style="font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 14px;">
        Pemberitahuan otomatis dikirim oleh Sistem Inventori Terintegrasi Raddina Health Service.
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions: nodemailer.SendMailOptions = {
      from: process.env.SMTP_FROM || 'notifikasi@raddinahealth.com',
      to: recipientEmail,
      subject: `[Peringatan Inventori] ${batches.length} Batch Obat Mendekati Kedaluwarsa (< 90 Hari) - RHS`,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email ringkasan batch mendekati kedaluwarsa berhasil dikirim ke ${recipientEmail} (MessageId: ${info.messageId})`,
      );
      return info;
    } catch (error) {
      this.logger.error(
        `Gagal mengirimkan email ringkasan ke ${recipientEmail}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
