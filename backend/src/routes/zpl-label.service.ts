import { Injectable, Logger } from '@nestjs/common';
import { Route } from './entities/route.entity';
import { Order } from '../orders/entities/order.entity';
import { Store } from '../stores/entities/store.entity';

interface SenderInfo {
  name: string;
  address: string;
  city: string;
  district: string;
  phone: string;
}

@Injectable()
export class ZplLabelService {
  private readonly logger = new Logger(ZplLabelService.name);

  async generateZpl(route: Route): Promise<string> {
    const orderLabels = route.orders.map((order, index) => 
      this.generateOrderLabel(order, index + 1)
    );

    return this.wrapInHtml(orderLabels);
  }

  private getSenderInfo(store: Store | null): SenderInfo {
    return {
      name: store?.senderName || 'Gönderen',
      address: store?.senderAddress || '',
      city: store?.senderCity || '',
      district: store?.senderDistrict || '',
      phone: store?.senderPhone || '',
    };
  }

  private formatSenderAddress(sender: SenderInfo): string {
    const parts = [sender.address, sender.district, sender.city].filter(Boolean);
    return parts.join(' / ');
  }

  private generateOrderLabel(order: Order, index: number): string {
    const cargoBarcode = order.cargoTrackingNumber || order.orderNumber;
    const receiverName = `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim();
    
    const shipmentAddress = order.shipmentAddress as any;
    const receiverAddress = this.formatReceiverAddress(shipmentAddress);
    
    const orderDate = new Date(Number(order.orderDate));
    const formattedDate = this.formatDate(orderDate);
    
    const cargoProvider = order.cargoProviderName || 'Kargo';
    const storeName = order.store?.name || 'Trendyol';

    const sender = this.getSenderInfo(order.store);
    const senderFullAddress = this.formatSenderAddress(sender);

    const productRows = this.generateProductRows(order);

    return `
      <script type="text/javascript">
        $(document).ready(function () {
          JsBarcode(".barcode_${index}", "${cargoBarcode}", {width: 2, height: 50, fontSize: 16, marginTop: 3, margin: 1, fontOptions: "bold" });
        });
      </script>

      <div class="rotate">
        <table style="border-spacing: 0px;border-collapse: collapse; width: 98%;">
          <tbody>
            <tr>
              <td style="border: 1px solid; border-collapse: collapse;font-size:10px;">
                <table style="border-collapse: collapse;border-spacing: 0px;">
                  <tbody>
                    <tr>
                      <td colspan="5" style="height: 20mm; text-align: center;">
                        <svg class="barcode_${index}"></svg>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="width: 55%;height: 20mm; border-top: 1px solid; border-right: 1px solid; vertical-align: top; font-size: 12px;">
                        <b>ALICI:<br>
                        ${receiverName} / <br>
                        ${receiverAddress}
                        </b>
                      </td>
                      <td colspan="3" style="width: 45%;height: 20mm; border-top: 1px solid; vertical-align: top; font-size: 10px;">
                        <b>GÖNDEREN:</b><br>
                        ${sender.name}<br>
                        ${senderFullAddress}${sender.phone ? `<br>Tel: ${sender.phone}` : ''}
                      </td>
                    </tr>
                    <tr>
                      <td style="border-top: 1px solid; border-right: 1px solid; vertical-align: top;">
                        <b>FATURA NO:</b><br>${order.orderNumber}
                      </td>
                      <td style="border-top: 1px solid; border-right: 1px solid; vertical-align: top;">
                        <b>FATURA TARİHİ:</b><br>
                        ${formattedDate}
                      </td>
                      <td style="border-top: 1px solid; border-right: 1px solid; vertical-align: top;">
                        <b>SİPARİŞ NO:</b><br>
                        ${order.orderNumber}
                      </td>
                      <td style="border-top: 1px solid; border-right: 1px solid; vertical-align: top;">
                        <b>KAYNAK</b><br>
                        ${storeName}
                      </td>
                      <td style="border-top: 1px solid; vertical-align: top;">
                        <b>TAŞIYICI</b><br>
                        ${cargoProvider}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style="font-size:8.5px;border-left:1px solid;border-right:1px solid;border-bottom:1px solid;">
                Bilgilendirme: Firmamız E-fatura Mükellefidir. Faturanız kayıtlı e-posta adresinize gönderilmiştir.
              </td>
            </tr>
            <tr>
              <td style="font-size:10px;border-left:1px solid;border-right:1px solid;">
                <table style="border-spacing: 0px;width:100%;">
                  <tbody>
                    <tr>
                      <td style="font-weight:bold;border-right:1px solid;border-bottom:1px solid;">Sıra No</td>
                      <td style="font-weight:bold;border-right:1px solid;border-bottom:1px solid;">Malzeme/Hizmet Kodu</td>
                      <td style="font-weight:bold;border-right:1px solid;border-bottom:1px solid;">Malzeme/Hizmet Açıklaması</td>
                      <td style="font-weight:bold;border-bottom:1px solid;">Miktar</td>
                    </tr>
                    ${productRows}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="break" style="page-break-after: always"></div>
    `;
  }

  private generateProductRows(order: Order): string {
    if (!order.lines || !Array.isArray(order.lines)) {
      return '';
    }

    return order.lines.map((line: any, idx: number) => {
      const barcode = line.barcode || line.productBarcode || '-';
      const productName = line.productName || line.name || 'Ürün';
      const quantity = line.quantity || 1;

      return `
        <tr>
          <td style="width:7mm;border-right:1px solid;border-bottom:1px solid;">${idx + 1}</td>
          <td style="width:30mm;border-right:1px solid;border-bottom:1px solid;">${barcode}</td>
          <td style="font-size:8px;border-right:1px solid;border-bottom:1px solid;">
            ${productName}
          </td>
          <td style="width:9mm;border-bottom:1px solid;text-align:right;">${quantity}</td>
        </tr>
      `;
    }).join('');
  }

  private formatReceiverAddress(shipmentAddress: any): string {
    if (!shipmentAddress) {
      return '';
    }

    const parts = [
      shipmentAddress.address1 || shipmentAddress.fullAddress || '',
      shipmentAddress.district || '',
      shipmentAddress.city || '',
      shipmentAddress.country || 'Türkiye',
    ].filter(Boolean);

    return parts.join(' / ');
  }

  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  private wrapInHtml(orderLabels: string[]): string {
    return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Sipariş Etiketleri</title>
  <style type="text/css">
    body {
      font-family: "Arial";
    }

    html body {
      width: 100mm;
      height: 100mm;
      display: block;
      margin: 1px 1px 1px 5px;
    }

    @media print {
      @page {
        size: 100mm 100mm;
        page-break-after: always;
        padding: 0px;
        margin: 0px;
      }
    }

    .break {
      page-break-after: always;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
</head>
<body>
  ${orderLabels.join('\n')}
  <script type="text/javascript">
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `.trim();
  }
}
