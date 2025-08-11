// app/api/example/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase-admin'; // This is your Firestore instance
import * as admin from 'firebase-admin'; // <--- ADD THIS IMPORT!

export async function POST(request: NextRequest) {
  try {
    const { message, userId } = await request.json();

    if (!message || !userId) {
      return NextResponse.json(
        { error: 'Message and userId are required.' },
        { status: 400 } // Bad Request
      );
    }

    const docRef = await dbAdmin.collection('messages').add({
      text: message,
      authorId: userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(), // <--- USE THIS LINE!
    });

    return NextResponse.json(
      { success: true, docId: docRef.id, message: 'Message added successfully!' },
      { status: 200 } // OK
    );

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 } // Internal Server Error
    );
  }
}
