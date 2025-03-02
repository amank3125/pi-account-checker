import { NextResponse } from 'next/server';


// Cache the price data
let cachedPrice: number | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    // Check if we have a valid cached price
    const now = Date.now();
    if (cachedPrice && now - lastFetchTime < CACHE_DURATION) {
      return NextResponse.json({ price: cachedPrice });
    }

    // Fetch new price from CryptoCompare
    const response = await fetch(
      'https://min-api.cryptocompare.com/data/price?fsym=PI&tsyms=USD',
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CryptoCompare API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Validate the response structure
    if (!data || typeof data.USD !== 'number') {
      throw new Error('Invalid response format from CryptoCompare API');
    }

    const price = data.USD;

    // Update cache
    cachedPrice = price;
    lastFetchTime = now;

    return NextResponse.json({ price });
  } catch (error) {
    console.error('Price fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Pi price' },
      { status: 500 }
    );
  }
}