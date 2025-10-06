#!/usr/bin/env node
// Bulk fix all non-canonical categories to canonical taxonomy

import pg from 'pg';
import 'dotenv/config';

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error('[bulk-fix] POSTGRES_URL not set');
  process.exit(1);
}

// Comprehensive mapping of non-canonical to canonical categories
const BULK_MAPPINGS = {
  // Clothing & Accessories
  'Accessory': 'Clothing & Accessories',
  'Belt Accessories': 'Clothing & Accessories',
  'Boys Hoodies & Sweatshirts, Girls Hoodies & Sweatshirts': 'Clothing & Accessories',
  'Boys Pajamas': 'Clothing & Accessories',
  'Boys Sweatpants, Girls Sweatpants': 'Clothing & Accessories',
  'Dress': 'Clothing & Accessories',
  'Ens. Pantalon': 'Clothing & Accessories',
  'Girls Dresses': 'Clothing & Accessories',
  'Girls Jackets & Coats': 'Clothing & Accessories',
  'Girls Sweater Dresses': 'Clothing & Accessories',
  'Intimates': 'Clothing & Accessories',
  'Jumpsuits': 'Clothing & Accessories',
  'Men\'s Long Sleeve': 'Clothing & Accessories',
  'Men\'s Outerwear': 'Clothing & Accessories',
  'Mens - Boardshort': 'Clothing & Accessories',
  'Mens - Hat': 'Clothing & Accessories',
  'Mens - Hybrid Short': 'Clothing & Accessories',
  'Mens - Shirt': 'Clothing & Accessories',
  'Mens - Sweatshirt': 'Clothing & Accessories',
  'Mens - Swim Trunk': 'Clothing & Accessories',
  'Mens - Tee': 'Clothing & Accessories',
  'Mens - Wetsuit': 'Clothing & Accessories',
  'Robe': 'Clothing & Accessories',
  'Robes': 'Clothing & Accessories',
  'Robes de bal': 'Clothing & Accessories',
  'Robes demoiselle d\'honneur': 'Clothing & Accessories',
  'Shoes': 'Clothing & Accessories',
  'Skirts': 'Clothing & Accessories',
  'Sunglasses': 'Clothing & Accessories',
  'T-Shirt': 'Clothing & Accessories',
  'Tri-Blend Graphic Tees': 'Clothing & Accessories',
  'Womens - Hat': 'Clothing & Accessories',
  'Womens - Sweatshirt': 'Clothing & Accessories',
  'Womens Cardigans': 'Clothing & Accessories',
  'Womens Denim': 'Clothing & Accessories',
  'Womens Gloves': 'Clothing & Accessories',
  'Womens Hats': 'Clothing & Accessories',
  'Womens Leggings': 'Clothing & Accessories',
  'Womens Pajamas': 'Clothing & Accessories',
  'Womens Sets': 'Clothing & Accessories',
  'Sleep Masks': 'Clothing & Accessories',
  'Christmas - Accessories - Hair Accessories': 'Clothing & Accessories',
  'Womens - Backpack': 'Clothing & Accessories',
  'Shoe Bag': 'Clothing & Accessories',
  'clothing rack': 'Home & Garden',

  // Jewelry
  'Collier': 'Jewelry & Watches',
  'Hand Chain': 'Jewelry & Watches',
  'Simple Wooden Wedding band': 'Jewelry & Watches',
  'Womens Wedding Bands': 'Jewelry & Watches',
  '3d Ring': 'Jewelry & Watches',

  // Leather Goods
  'Leather 5 Card Wallet': 'Clothing & Accessories',
  'Leather A5 Notebook Cover': 'Office & Stationery',
  'Leather A6 Notebook Cover': 'Office & Stationery',
  'Leather Apple Watch Band': 'Clothing & Accessories',
  'Leather Belt': 'Clothing & Accessories',
  'Leather Biker Wallet': 'Clothing & Accessories',
  'Leather Checkbook Wallet': 'Clothing & Accessories',
  'Leather Clutch Wallet': 'Clothing & Accessories',
  'Leather Coaster': 'Home & Garden',
  'Leather Dog Collar Companion': 'Pet Supplies',
  'Leather Field Notes Notebook Cover': 'Office & Stationery',
  'Leather Front Pocket Wallet': 'Clothing & Accessories',
  'Leather Hobonichi Cousin A5 Notebook Cover': 'Office & Stationery',
  'Leather Hobonichi Cover': 'Office & Stationery',
  'Leather ID Wallet': 'Clothing & Accessories',
  'Leather Leuchtturm1917 A5 Notebook Cover': 'Office & Stationery',
  'Leather Leuchtturm1917 Cover - A6': 'Office & Stationery',
  'Leather Long Wallet': 'Clothing & Accessories',
  'Leather Midori MD A6 Notebook Cover': 'Office & Stationery',
  'Leather Mini Wristlet': 'Clothing & Accessories',
  'Leather Moleskine Cover - Large': 'Office & Stationery',
  'Leather Moleskine Cover - Pocket': 'Office & Stationery',
  'Leather Money Clip Wallet': 'Clothing & Accessories',
  'Leather Mouse Pad': 'Office & Stationery',
  'Leather Passport Case': 'Travel & Luggage',
  'Leather Rhodia A5 Notebook Cover': 'Office & Stationery',
  'Leather Rhodia A6 Notebook Cover': 'Office & Stationery',
  'Leather Stalogy 365 Days A6 Notebook Cover': 'Office & Stationery',
  'Leather Traditional Wallet': 'Clothing & Accessories',
  'Leather Trifold Wallet': 'Clothing & Accessories',
  'Leather Vertical Wallet': 'Clothing & Accessories',
  'Leather Watch Band': 'Jewelry & Watches',

  // Food & Beverages
  'Antipasto': 'Food & Beverages',
  'Baking - Cupcake Kits': 'Food & Beverages',
  'Bundles & Towers': 'Food & Beverages',
  'Cheese Accessory': 'Food & Beverages',
  'Chocolate Bar': 'Food & Beverages',
  'Chorizo': 'Food & Beverages',
  'Coffee Cakes': 'Food & Beverages',
  'Cow\'s Milk Cheese': 'Food & Beverages',
  'DIY Drink': 'Food & Beverages',
  'Dried Fruit': 'Food & Beverages',
  'Goat\'s Milk Cheese': 'Food & Beverages',
  'Kits - Multi-Tea Kits': 'Food & Beverages',
  'Kits - Sachet Products': 'Food & Beverages',
  'Pancetta': 'Food & Beverages',
  'Pepperoni': 'Food & Beverages',
  'Pie': 'Food & Beverages',
  'Pretzel': 'Food & Beverages',
  'Prosciutto': 'Food & Beverages',
  'Recipe Box': 'Food & Beverages',
  'Salami': 'Food & Beverages',
  'Seafood': 'Food & Beverages',
  'Soda': 'Food & Beverages',
  'Sopressata': 'Food & Beverages',

  // Home & Garden
  'Basket': 'Home & Garden',
  'Bookshelf': 'Home & Garden',
  'bookshelf 2.0': 'Home & Garden',
  'Chairs': 'Home & Garden',
  'Coffee Mug': 'Home & Garden',
  'Dinnerware': 'Home & Garden',
  'Garden Essentials': 'Home & Garden',
  'Garden Tools': 'Home & Garden',
  'Hard Goods - Cup/Mug': 'Home & Garden',
  'Hard Goods - On the go': 'Home & Garden',
  'Lids': 'Home & Garden',
  'Mirror': 'Home & Garden',
  'Pans': 'Home & Garden',
  'Pillow Cover': 'Home & Garden',
  'Planter': 'Home & Garden',
  'Plates': 'Home & Garden',
  'Serveware': 'Home & Garden',
  'Tea Towels': 'Home & Garden',
  'Tin': 'Home & Garden',
  'Tumblers': 'Home & Garden',
  'Washing Machine': 'Home & Garden',
  'Wooden Laptop Stand': 'Home & Garden',
  'night light': 'Home & Garden',
  'Traveler (20oz)': 'Home & Garden',
  'Traveler (32oz)': 'Home & Garden',
  'Traveler (40oz)': 'Home & Garden',
  'Traveler Lid': 'Home & Garden',
  'Protour': 'Home & Garden',
  'Protour 30oz': 'Home & Garden',
  'Can Cooler (Slim)': 'Home & Garden',
  'Can Cooler (Standard)': 'Home & Garden',
  'Straw 4 Pack': 'Home & Garden',
  'Beer Jacket': 'Home & Garden',

  // Health & Beauty
  'Blush': 'Health & Beauty',
  'Body Cream': 'Health & Beauty',
  'Body Washes': 'Health & Beauty',
  'Brow Maintenance': 'Health & Beauty',
  'Deodorant': 'Health & Beauty',
  'Exfoliators': 'Health & Beauty',
  'Eyebrow Enhancer': 'Health & Beauty',
  'Facial Spray': 'Health & Beauty',
  'Hair & Body': 'Health & Beauty',
  'Hair Styling Products': 'Health & Beauty',
  'Ingrown Hair Treatments': 'Health & Beauty',
  'Lip Makeup': 'Health & Beauty',
  'Lip Treatment': 'Health & Beauty',
  'Shave & Beard': 'Health & Beauty',
  'Beard Сomb': 'Health & Beauty',
  'Treatment': 'Health & Beauty',
  'Cheek + Lip Set': 'Health & Beauty',
  'Skin + Color Set': 'Health & Beauty',

  // Wellness
  'DIFFUSER & OILS': 'Wellness & Self-Care',
  'Self Care': 'Wellness & Self-Care',
  'Travel Kits': 'Wellness & Self-Care',

  // Toys & Games
  '1000 Piece': 'Toys & Games',
  '275 Piece': 'Toys & Games',
  '36 Piece': 'Toys & Games',
  'Activity Craft Kits': 'Toys & Games',
  'Bicycle Playing Cards': 'Toys & Games',
  'Boardgame': 'Toys & Games',
  'Bridge': 'Toys & Games',
  'Building Sets': 'Toys & Games',
  'Climbing Set': 'Toys & Games',
  'Figures & Play Sets': 'Toys & Games',
  'Miniature Games': 'Toys & Games',
  'Misc. Toys': 'Toys & Games',
  'Montessori Tower': 'Toys & Games',
  'Name Puzzle': 'Toys & Games',
  'Piggy Bank': 'Toys & Games',
  'Steps': 'Toys & Games',
  'Tokens': 'Toys & Games',
  'Vehicles & Trains': 'Toys & Games',
  'ZZZFun/Games': 'Toys & Games',
  'ZZZPlush': 'Toys & Games',
  'PLUSH': 'Toys & Games',

  // Kids & Baby
  'Enfant': 'Kids & Baby',

  // Electronics & Gadgets
  '13/14-inch Laptop': 'Electronics & Gadgets',
  'Bone Conduction Headphones': 'Electronics & Gadgets',
  'Communication Headsets': 'Electronics & Gadgets',
  'Digital Business Card': 'Electronics & Gadgets',
  'Hearing Protection': 'Electronics & Gadgets',
  'MagSafe Grip Loop': 'Electronics & Gadgets',
  'MagSafe Grip Ring': 'Electronics & Gadgets',
  'MagSafe Mount': 'Electronics & Gadgets',
  'MagSafe Power Pack': 'Electronics & Gadgets',
  'NFC Business Card': 'Electronics & Gadgets',
  'Open Earbuds': 'Electronics & Gadgets',
  'PC': 'Electronics & Gadgets',

  // Office & Stationery
  'Alphabet': 'Office & Stationery',
  'Custom Stamps': 'Office & Stationery',
  'CUSTOMIZABLE PICTURE FRAME': 'Office & Stationery',

  // Party & Seasonal
  'Advent Calendar': 'Seasonal & Holiday',
  'Bundle - Party - Everyday': 'Party Supplies & Decorations',
  'Bundle - Party - Seasonal': 'Party Supplies & Decorations',
  'Christmas - Party Supplies - Garlands': 'Seasonal & Holiday',
  'Christmas - Tableware - Cups': 'Seasonal & Holiday',
  'Christmas - Tableware - Napkins': 'Seasonal & Holiday',
  'Christmas - Tableware - Plates': 'Seasonal & Holiday',
  'Digital Invite - Digital Invite': 'Party Supplies & Decorations',
  'Event': 'Party Supplies & Decorations',
  'Event Decor': 'Party Supplies & Decorations',
  'Halloween - Party Supplies - Garlands': 'Seasonal & Holiday',
  'Halloween - Tableware - Napkins': 'Seasonal & Holiday',
  'Halloween - Tableware - Plates': 'Seasonal & Holiday',
  'Holiday': 'Seasonal & Holiday',
  'Holiday Card Sets': 'Seasonal & Holiday',
  'Holiday Kit': 'Seasonal & Holiday',
  'Holiday Set-dg': 'Seasonal & Holiday',
  'Seasonal': 'Seasonal & Holiday',
  'Thanksgiving - Tableware - Napkins': 'Seasonal & Holiday',
  'Tissue Paper': 'Party Supplies & Decorations',
  'Wedding Time': 'Party Supplies & Decorations',
  '10 YEAR ANNIVERSARY EVENT': 'Party Supplies & Decorations',
  'birthday gift': 'Party Supplies & Decorations',

  // Flowers & Plants
  'Anemone': 'Flowers & Plants',
  'Arrangement': 'Flowers & Plants',
  'English Climbing Rose': 'Flowers & Plants',
  'English Shrub Rose': 'Flowers & Plants',
  'Everyday Plants': 'Flowers & Plants',
  'Fritillaria Persica': 'Flowers & Plants',
  'Kit Bouquet': 'Flowers & Plants',
  'Naturals': 'Flowers & Plants',
  'PERENNIAL COLLECTION': 'Flowers & Plants',
  'Ranunculus': 'Flowers & Plants',
  'Rose': 'Flowers & Plants',
  'Shade Perennials': 'Flowers & Plants',
  'Stems': 'Flowers & Plants',

  // Sports & Outdoors
  'BJJ Spats': 'Sports & Outdoors',
  'Boxing Gloves': 'Sports & Outdoors',
  'Dropper Posts': 'Sports & Outdoors',
  'Fight Shorts': 'Sports & Outdoors',
  'Guides & Chainrings': 'Sports & Outdoors',
  'Hand Wraps': 'Sports & Outdoors',
  'Handlebar Bundles': 'Sports & Outdoors',
  'Handlebars': 'Sports & Outdoors',
  'HELMET': 'Sports & Outdoors',
  'Helmet': 'Sports & Outdoors',
  'Hubs': 'Sports & Outdoors',
  'Jiu Jitsu Gis': 'Sports & Outdoors',
  'Pedals': 'Sports & Outdoors',
  'Rash Guards': 'Sports & Outdoors',
  'Grinders': 'Sports & Outdoors',
  'Grips': 'Sports & Outdoors',

  // Collectibles & Gifts
  'City Map': 'Collectibles & Memorabilia',
  'Germany Map': 'Collectibles & Memorabilia',
  'LED Map of USA': 'Collectibles & Memorabilia',
  'Peel & Stick Print': 'Collectibles & Memorabilia',
  'Travel Tracker': 'Collectibles & Memorabilia',
  'CLASSIC BOXES': 'Collectibles & Memorabilia',
  'L\'ALPHABET - THE LETTER COLLECTION': 'Collectibles & Memorabilia',

  // Gift Cards & Experiences
  'DB Gift': 'Gift Cards & Experiences',
  'Passport Reward': 'Gift Cards & Experiences',
  'Passport Reward-dg': 'Gift Cards & Experiences',

  // Art & Crafts
  'Etching': 'Art & Crafts',
  'Paint': 'Art & Crafts',

  // Personalized Gifts
  'GIFT PACKAGING': 'Personalized Gifts',
  'GIFT SETS': 'Personalized Gifts',
  'Gift Add-On': 'Personalized Gifts',
  'Gift Option': 'Personalized Gifts',
  'Gift Set': 'Personalized Gifts',
  'Gifts': 'Personalized Gifts',
  'SIGNATURE CANDLES': 'Personalized Gifts',

  // Subscription
  'ReCharge Subscription': 'Subscription Boxes',

  // Bags & Travel
  'Bullet Ruck': 'Travel & Luggage',
  'Field Pocket': 'Travel & Luggage',
  'GR0': 'Travel & Luggage',
  'GR2': 'Travel & Luggage',
  'Gear Accessories': 'Travel & Luggage',
  'HEADWEAR': 'Travel & Luggage',
  'Kit Bag': 'Travel & Luggage',
  'Radio Ruck': 'Travel & Luggage',
  'travel box': 'Travel & Luggage',

  // Bundles (generic to Home)
  'Bundle': 'Home & Garden',
  'Bundle Galaxy': 'Electronics & Gadgets',
  'Bundle iPhone': 'Electronics & Gadgets',
  'Bundles': 'Home & Garden',
  'bundle': 'Home & Garden',
  'bundle-dg': 'Home & Garden',
  'product-type-bundle': 'Home & Garden',
  'Pattern Bundle': 'Home & Garden',
  'Sets': 'Home & Garden',

  // Misc / Uncategorized edge cases → default to Home & Garden
  'Addition': 'Home & Garden',
  'Brooklittles': 'Home & Garden',
  'Bulk & Save': 'Home & Garden',
  'Cafe': 'Home & Garden',
  'Combined Listing': 'Home & Garden',
  'Discontinued': 'Home & Garden',
  'Duplicate Listing': 'Home & Garden',
  'EDC': 'Home & Garden',
  'Extend Protection Plan': 'Gift Cards & Experiences',
  'Free Gift': 'Gift Cards & Experiences',
  'GWP': 'Gift Cards & Experiences',
  'Knives': 'Home & Garden',
  'Merch': 'Collectibles & Memorabilia',
  'Parking': 'Gift Cards & Experiences',
  'Phone Charm': 'Electronics & Gadgets',
  'Qlectors': 'Collectibles & Memorabilia',
  'RPC': 'Home & Garden',
  'Refurbished Products': 'Electronics & Gadgets',
  'SCIKIT': 'Home & Garden',
  'Service': 'Gift Cards & Experiences',
  'Spare Parts': 'Automotive',
  'Stacker': 'Home & Garden',
  'Supply': 'Home & Garden',
  'Tag': 'Home & Garden',
  'Wholesale Pattern': 'Home & Garden',

  // Date strings (probably data errors) → seasonal
  'Fri Jan 03 2025 22:00:00 GMT+0100 (Central European Standard Time)': 'Seasonal & Holiday',
  'Sun Jan 05 2025 22:00:00 GMT+0100 (Central European Standard Time)': 'Seasonal & Holiday',
  'Tue Dec 31 2024 22:00:00 GMT+0100 (Central European Standard Time)': 'Seasonal & Holiday',
  'Tue Jan 07 2025 22:00:00 GMT+0100 (Central European Standard Time)': 'Seasonal & Holiday',
  'Accessoires mariage': 'Party Supplies & Decorations',
};

async function main() {
  const client = new pg.Client({ connectionString: POSTGRES_URL });
  await client.connect();

  try {
    let totalFixed = 0;

    for (const [sourceCategory, canonical] of Object.entries(BULK_MAPPINGS)) {
      // Get canonical category ID
      const { rows: catRows } = await client.query('SELECT id FROM categories WHERE name = $1', [canonical]);
      if (catRows.length === 0) {
        console.log(`[bulk-fix] Skipping "${sourceCategory}" - canonical "${canonical}" not found`);
        continue;
      }
      const targetCategoryId = catRows[0].id;

      // Get source category ID
      const { rows: srcRows } = await client.query('SELECT id FROM categories WHERE name = $1', [sourceCategory]);
      if (srcRows.length === 0) {
        // Category doesn't exist in DB, skip
        continue;
      }
      const sourceCategoryId = srcRows[0].id;

      // Update all products with this source category to canonical
      const result = await client.query(`
        UPDATE products SET category_id = $1
        WHERE category_id = $2
      `, [targetCategoryId, sourceCategoryId]);

      if (result.rowCount > 0) {
        console.log(`[bulk-fix] "${sourceCategory}" → "${canonical}": ${result.rowCount} products`);
        totalFixed += result.rowCount;
      }
    }

    console.log(`\n[bulk-fix] Total fixed: ${totalFixed} products`);

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[bulk-fix] Error:', err);
  process.exit(1);
});
