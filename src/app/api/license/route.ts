import { NextResponse } from "next/server";

export async function GET() {
  const data = {
    serialNumber: process.env.BPM_SERIAL_NUMBER ?? "",
    licenseDate: process.env.BPM_LICENSE_DATE ?? "",
    licenseCompany: process.env.BPM_LICENSE_COMPANY ?? "",
    licenseCustomer: process.env.BPM_LICENSE_CUSTOMER ?? "",
  };
  return NextResponse.json(data);
}
