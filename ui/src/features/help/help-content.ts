// The user manual shown at /help. Written for shop owners and counter staff, in plain words, using the exact
// labels on screen. When a screen, label or rule changes, update the matching article here.
//
// Inline marks inside text: **bold** for on-screen labels, `F12` for keys (shown as key caps).

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "list"; items: string[] }
  | { type: "tip"; text: string }
  | { type: "warn"; text: string }
  | { type: "table"; head: string[]; rows: string[][] };

export interface HelpArticle {
  id: string;
  title: string;
  /** Set when only some roles can do this (e.g. managers). */
  who?: string;
  blocks: HelpBlock[];
}

export interface HelpSection {
  id: string;
  title: string;
  intro: string;
  /** Who usually does this, shown as a small note. */
  who?: string;
  articles: HelpArticle[];
}

export const HELP: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    intro: "Register your shop, wait for approval, then set things up once before the first bill.",
    who: "Shop owner",
    articles: [
      {
        id: "register",
        title: "Register your business",
        blocks: [
          {
            type: "steps",
            items: [
              "Open the sign-up page and click **Register your business**.",
              "Under **Your business**, enter the **Business name**, **City** and **State**. **GSTIN** is optional; a valid GSTIN fills the state for you.",
              "Under **Owner login**, enter your name, **Mobile number**, **Email** and a **Password** of at least 8 characters.",
              "Click **Register business**.",
              "Open the email we send you and click the link to confirm your email address.",
            ],
          },
          {
            type: "p",
            text: "Every new business is checked before it is switched on, usually within a day. You get an email when your shop is approved. Until then, logging in shows **Your shop is waiting for approval**.",
          },
        ],
      },
      {
        id: "first-day",
        title: "First-day setup checklist",
        blocks: [
          { type: "p", text: "Do these once, in this order. Each step is in **Settings** or **Inventory**." },
          {
            type: "steps",
            items: [
              "**Settings → Business profile**: legal name, GSTIN, state, address, and your bank and UPI details (they print on A4 bills).",
              "**Settings → Branches**: check your main branch, and add any other branches with their own code (for example KOC).",
              "**Settings → Billing & tax**: choose the bill paper size, the default payment mode, the maximum discount without approval and whether to print right after charging.",
              "**Settings → Users**: add your staff with their mobile number, a temporary password, a role and their branches.",
              "**Inventory → Import**: download the template, fill in your items and opening stock, and import it.",
              "**Customers**: add customers who already owe you money, then use **Add old dues** on each one.",
              "Open **POS billing**, open a shift and make your first bill.",
            ],
          },
          {
            type: "tip",
            text: "Not sure which role to give someone? See **Staff and roles** below. You can change a person's role at any time.",
          },
        ],
      },
      {
        id: "login",
        title: "Logging in and out",
        blocks: [
          {
            type: "list",
            items: [
              "In **Username**, type your mobile number or your email, then your **Password**, and click **Log in**.",
              "If you work in more than one branch, click the branch name under your shop's name in the left menu to switch. Each branch has its own stock, bills and cart.",
              "To log out, click your initials in the top right and choose **Log out**.",
            ],
          },
          {
            type: "warn",
            text: "After 8 wrong passwords in a row, that login is blocked for 15 minutes, even with the right password. Wait, or ask the owner to set a new password for you.",
          },
        ],
      },
    ],
  },
  {
    id: "billing",
    title: "Billing at the counter",
    intro: "Open a shift, pick the customer, add items, take payment and print. All from the keyboard if you like.",
    who: "Counter staff and managers",
    articles: [
      {
        id: "open-shift",
        title: "Open a shift",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **POS billing** in the left menu (or press `F2`).",
              "Count the cash in the drawer. Enter the **Counter** name and the **Opening cash**.",
              "Click **Open shift**.",
            ],
          },
          {
            type: "p",
            text: "You need an open shift to bill. When you close it, you count again and see any difference.",
          },
        ],
      },
      {
        id: "make-bill",
        title: "Make a bill",
        blocks: [
          {
            type: "steps",
            items: [
              "**Who is the customer?** Type their mobile number or email and click **Start billing**. Every bill needs a customer.",
              "If they are new, enter their **Customer name** and click **Save and start billing**. If they have an email, their bill is emailed to them automatically.",
              "Add items: scan the barcode, or type part of the name, SKU or OEM number in the search box (`F3` or `/`) and press `Enter` to add the first match. Use the **Labour** chip for labour charges.",
              "Change a quantity with `+` and `−`, or select the line and press `Enter` to type it. `Del` removes the selected line.",
              "Choose how they pay: **Cash** (`Alt+1`), **UPI** (`Alt+2`), **Card** (`Alt+3`) or **Pay later** (`Alt+4`).",
              "Press `F12` (or click **Charge**). Check the amounts in the payment box and press `Enter` to charge.",
            ],
          },
          {
            type: "tip",
            text: "Customer paying the exact total in cash? Press `F4` to charge it straight away, without the payment box.",
          },
        ],
      },
      {
        id: "discounts",
        title: "Give a discount",
        blocks: [
          {
            type: "list",
            items: [
              "On one line: select the line and press `Shift+F9`, or click **Discount** on the line.",
              "On the whole bill: press `F9`, or click **Discount** in the totals. It is spread across the lines before GST.",
              "Choose **₹ Amount** or **% Percent**, enter the value and click **Apply**.",
            ],
          },
          {
            type: "p",
            text: "If the discount is above your limit (set in **Settings → Billing & tax**), the cart says a manager will approve it when you charge.",
          },
        ],
      },
      {
        id: "payment",
        title: "Take payment, split payments and Pay later",
        blocks: [
          {
            type: "list",
            items: [
              "For cash, type the **Cash received**. The box shows the **Change to return**.",
              "For UPI or card, add the **Reference** (UPI ref. no., or the last 4 digits or approval code).",
              "Customer paying part cash and part UPI? Click **Split payment** to add another line.",
              "Anything not paid now is kept as the customer's **Dues (pay later)**. With **Pay later** selected, the whole bill becomes dues.",
              "**Pay later** only works once a customer is on the bill. The cart shows how much they **Can still owe** and in how many days they must pay.",
            ],
          },
          {
            type: "p",
            text: "Bank transfer and cheque payments are not taken at the POS. Record them later on the invoice with **Collect**.",
          },
        ],
      },
      {
        id: "approval",
        title: "Manager approval",
        blocks: [
          {
            type: "p",
            text: "When a discount is above the limit, or the dues would go above the customer's **Maximum dues allowed**, the box **Manager approval needed** appears.",
          },
          {
            type: "steps",
            items: [
              "A manager or the owner types their own **Manager's mobile number** and **Password** on your screen.",
              "They click **Approve and charge**. Their name is saved on the invoice as the approver.",
            ],
          },
          {
            type: "warn",
            text: "You can't approve your own bill. After 8 wrong tries, approvals from that counter and for that manager are blocked for 15 minutes.",
          },
        ],
      },
      {
        id: "print",
        title: "Print or reprint a bill",
        blocks: [
          {
            type: "list",
            items: [
              "After charging, **Bill saved** appears. Press `Enter` (or `P`) to print in your default size, or click **A4**, **A5**, **80 mm** or **58 mm**.",
              "Press `N` or `Esc` for the next bill.",
              "To reprint the last bill, press `Ctrl+P` or click **Reprint** below the cart.",
              "Older bills: open the invoice and use **Print**.",
            ],
          },
          {
            type: "tip",
            text: "Thermal printer cutting off the edges? In the browser's print window, set margins to none and scale to 100%.",
          },
        ],
      },
      {
        id: "hold",
        title: "Hold a bill and serve the next customer",
        blocks: [
          {
            type: "list",
            items: [
              "Press `F8` (**Hold cart**), give it a label if you like, and click **Hold cart**.",
              "Press `F6` to see **Held carts**, then **Resume** one, or **Discard** it.",
              "Held carts are shared by everyone at the branch.",
            ],
          },
        ],
      },
      {
        id: "close-shift",
        title: "Close the shift",
        blocks: [
          {
            type: "steps",
            items: [
              "Click **Close shift** at the top of the POS.",
              "Count what you took in each method and enter it next to **Cash**, **UPI** and **Card**. The expected cash includes the opening cash.",
              "Add a **Note** if something is off, and click **Close shift**.",
              "Check the difference for each method. Click **View report** to print the shift report.",
            ],
          },
          { type: "p", text: "Past shifts are under **Invoices → Shifts**." },
        ],
      },
    ],
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    intro: "Function keys work even while you are typing in a box. Press `F1` in the POS to see this list.",
    articles: [
      {
        id: "pos-keys",
        title: "In POS billing",
        blocks: [
          {
            type: "table",
            head: ["Key", "What it does"],
            rows: [
              ["`F3` or `/`", "Search items or scan a barcode"],
              ["`↑` `↓`", "Select a line in the cart"],
              ["`+` `−`", "Quantity of the selected line up or down by 1"],
              ["`Enter`", "Type the quantity of the selected line"],
              ["`Del`", "Remove the selected line"],
              ["`Shift+F9`", "Discount on the selected line"],
              ["`F9`", "Discount on the whole bill"],
              ["`F7`", "Attach a customer"],
              ["`Alt+1` `Alt+2` `Alt+3`", "Pay by Cash, UPI or Card"],
              ["`Alt+4`", "Pay later (dues)"],
              ["`F12`", "Charge"],
              ["`F4`", "Exact cash: charge the full total in cash"],
              ["`F8`", "Hold the bill"],
              ["`F6`", "Held bills"],
              ["`F10`", "New bill (clears the cart)"],
              ["`Ctrl+P`", "Reprint the last bill"],
              ["`F1`", "Show the shortcuts"],
              ["`Esc`", "Close a box, or go back to search"],
            ],
          },
        ],
      },
      {
        id: "app-keys",
        title: "Anywhere in the app",
        blocks: [
          {
            type: "table",
            head: ["Key", "What it does"],
            rows: [
              ["`Ctrl+K` (or `F3`)", "Search pages, invoices, customers and parts"],
              ["`F2`", "Go to POS billing"],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "invoices",
    title: "Invoices and payments",
    intro: "Find any bill, collect dues, correct mistakes and handle returns.",
    articles: [
      {
        id: "find",
        title: "Find an invoice",
        blocks: [
          {
            type: "p",
            text: "Open **Invoices**. Search by invoice number, customer or mobile, and filter by date, payment method, branch or status (**Paid**, **Partly paid**, **Unpaid**, **Overdue**, **Cancelled**). Click a row to open it.",
          },
        ],
      },
      {
        id: "collect",
        title: "Collect dues on a bill",
        blocks: [
          {
            type: "steps",
            items: [
              "Open the invoice and click **Collect**.",
              "Choose the **Method** (Cash, UPI, Card, Bank transfer or Cheque) and the **Amount**. It starts at the full balance.",
              "Add a **Reference** such as the UPI ref., cheque or UTR number, and click **Record**.",
            ],
          },
        ],
      },
      {
        id: "reverse",
        title: "Undo a wrong payment",
        who: "Managers",
        blocks: [
          {
            type: "p",
            text: "On the invoice, click **Reverse** next to the payment, enter a **Reason** and click **Reverse payment**. A reversal is added and the balance goes back up; the original payment stays on record.",
          },
        ],
      },
      {
        id: "returns",
        title: "Customer returns an item (credit note)",
        who: "Managers",
        blocks: [
          {
            type: "steps",
            items: [
              "Open the invoice and click **Credit note**.",
              "In **Items to return**, enter how many of each item came back.",
              "Enter the **Reason**. If they had paid more than the new total, choose the **Refund method**.",
              "Click **Create credit note**. The items go back to stock, and the customer's balance or refund is adjusted.",
            ],
          },
          { type: "p", text: "Credit notes are listed under **Invoices → Credit notes** and can be printed." },
        ],
      },
      {
        id: "cancel",
        title: "Cancel a bill",
        who: "Managers",
        blocks: [
          {
            type: "p",
            text: "Open the invoice, click **⋯ → Cancel invoice**, enter a **Reason** and confirm. All its stock comes back and any money received is recorded as refunded. The invoice number is kept, marked cancelled.",
          },
          {
            type: "warn",
            text: "A bill that already has a credit note can't be cancelled. Return the remaining items with another credit note instead.",
          },
        ],
      },
    ],
  },
  {
    id: "customers",
    title: "Customers and dues",
    intro: "Every bill has a customer. Set how much each one can owe, and track who owes what.",
    articles: [
      {
        id: "add-customer",
        title: "Add or edit a customer",
        blocks: [
          {
            type: "list",
            items: [
              "Open **Customers → New customer**. The **Mobile** number is how the POS finds them.",
              "**Customer type** is Retail, Fleet or Business (B2B). Business customers need a **GSTIN**.",
              "**Maximum dues allowed**: how much they may owe you at most. Set 0 if they must always pay the full bill.",
              "**Days to clear dues**: bills show as overdue after this many days.",
            ],
          },
          {
            type: "p",
            text: "Tax on the bill: a customer with a GSTIN from another state is charged IGST. Everyone else buying at your counter is charged CGST + SGST.",
          },
        ],
      },
      {
        id: "old-dues",
        title: "Bring in old dues from your ledger book",
        blocks: [
          {
            type: "steps",
            items: [
              "Open the customer and click **Add old dues**.",
              "Enter the **Amount they owe**, the date it has been **Owed since**, and a **Note** (for example, page 12 of the old ledger).",
              "Click **Add**. It appears as an **Old dues** bill that you collect like any other.",
            ],
          },
          { type: "p", text: "Old dues are not a sale, so they don't count in sales or GST reports." },
        ],
      },
      {
        id: "who-owes",
        title: "See who owes you money",
        blocks: [
          {
            type: "list",
            items: [
              "On a customer's page: **Total dues now** and how much they **Can still owe**.",
              "For everyone: **Reports → Receivables ageing** shows each customer's dues by how late they are.",
              "On the **Dashboard**: the **Receivables** card shows the overdue count.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "stock",
    title: "Items and stock",
    intro: "Keep items, prices and stock right in every branch.",
    who: "Owner, managers and storekeepers",
    articles: [
      {
        id: "items",
        title: "Add an item",
        blocks: [
          {
            type: "steps",
            items: [
              "Open **Inventory → New item**.",
              "Enter the **SKU**, **Item name**, unit, brand and category.",
              "Under **Pricing & tax**, pick the **HSN code** (it sets the GST rate) and enter the **Sale price** and **MRP**. Tick **Sale price includes GST** if your price already has tax in it.",
              "Add the **Barcodes** printed on the box, or leave it empty to print labels with the SKU.",
              "Click **Save item**.",
            ],
          },
          {
            type: "p",
            text: "To set the minimum stock and shelf location, open the item and click **Edit levels**. Items at or below the minimum show in **Low stock**.",
          },
        ],
      },
      {
        id: "import",
        title: "Import many items at once",
        blocks: [
          {
            type: "steps",
            items: [
              "Open **Inventory → Import** and click **Download template**.",
              "Fill it in (Excel works; save it as CSV). Only **sku**, **name** and **salePrice** are required. Put opening stock in **openingQty**.",
              "Click **Choose file**. Tick **Update existing items with the same SKU** to change prices of items you already have.",
              "Check the preview. Fix rows marked **Error** in your file and choose it again.",
              "Click **Import**.",
            ],
          },
          { type: "p", text: "Up to 2,000 rows per file. New brands and categories are created for you." },
        ],
      },
      {
        id: "adjust",
        title: "Correct stock (adjustments)",
        blocks: [
          {
            type: "steps",
            items: [
              "Open the item and click **Adjust stock**, or go to **Inventory → Adjustments**.",
              "Enter the change: +5 adds five, −2 removes two.",
              "Pick a **Reason**: Count correction, Damaged, Expired, Opening stock or Other (Other needs a note).",
              "Click **Save adjustment**.",
            ],
          },
          {
            type: "p",
            text: "Adjustments worth more than the approval limit (₹5,000 at purchase price unless changed) wait as **Awaiting approval** until a manager clicks **Approve and post**.",
          },
        ],
      },
      {
        id: "transfer",
        title: "Move stock to another branch",
        blocks: [
          {
            type: "steps",
            items: [
              "Open **Inventory → Transfers → New transfer**.",
              "Choose **To branch**, add the items and quantities, and a **Note** such as the driver's name.",
              "Click **Dispatch transfer**. The stock leaves this branch and shows as **In transit**.",
              "At the other branch, switch to that branch, open the transfer and click **Receive stock**.",
            ],
          },
        ],
      },
      {
        id: "labels",
        title: "Print barcode labels",
        blocks: [
          {
            type: "p",
            text: "Open the item and click **Print labels**, enter the number of **Copies** and click **Print**. Labels are 50 × 25 mm with name, SKU, price and barcode. Set the printer to 100% scale.",
          },
        ],
      },
      {
        id: "masters",
        title: "Labour charges, categories and vehicles",
        blocks: [
          {
            type: "list",
            items: [
              "**Inventory → Labour services**: fixed labour charges you add to bills, with their SAC code and rate before GST.",
              "**Inventory → Categories & brands**: categories, brands, HSN/SAC codes with their GST rate, and vehicle makes and models (used for **Fits vehicles** on items).",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "reports",
    title: "Reports and GST",
    intro: "Sales, dues, stock and GST returns for any period, ready to download.",
    who: "Owner, managers and accountants",
    articles: [
      {
        id: "report-list",
        title: "Which report to use",
        blocks: [
          {
            type: "table",
            head: ["Report", "Shows"],
            rows: [
              ["Sales register", "Bills in the period, or totals by day, customer, item, category or payment mode"],
              ["Day book", "Every bill, receipt, refund and credit note in order"],
              ["Shift report", "Each shift's sales, expected and counted cash, and the difference"],
              ["Receivables ageing", "What each customer owes today, by how late it is"],
              ["GSTR-1", "B2B, B2C, credit notes and HSN summary for filing"],
              ["GSTR-3B summary", "Tax on sales after credit notes"],
              ["HSN / SAC summary", "Quantity, value and tax per HSN/SAC code"],
              ["Stock valuation", "Stock value at purchase and sale price, and days since last sale"],
              ["Stock movement", "Opening, in, out and closing stock per item"],
            ],
          },
        ],
      },
      {
        id: "download",
        title: "Choose a period and download",
        blocks: [
          {
            type: "list",
            items: [
              "Pick **Today**, **Last 7 days**, **This month**, **Last month** or **This financial year**, or set your own dates (up to 366 days).",
              "Download with **CSV** or **Excel**.",
              "For GSTR-1, **Portal JSON** gives the file to upload on the GST portal. Check it with your accountant before filing.",
            ],
          },
        ],
      },
      {
        id: "tally",
        title: "Send entries to Tally",
        blocks: [
          {
            type: "steps",
            items: [
              "On **Reports**, use the **Tally export** card: choose the dates and what to include.",
              "Create the ledgers it lists in Tally first.",
              "Click **Download XML**, then in Tally go to **Gateway → Import → Vouchers**.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "settings",
    title: "Staff, roles and settings",
    intro: "Who can do what, bill numbers, and how bills print.",
    who: "Shop owner",
    articles: [
      {
        id: "users",
        title: "Add staff",
        blocks: [
          {
            type: "steps",
            items: [
              "Open **Settings → Users → New user**.",
              "Enter their name, **Mobile number** (they log in with it) and a **Temporary password**. Add an email so they can reset their own password.",
              "Choose a **Role** and the **Branches** they work in.",
            ],
          },
          {
            type: "p",
            text: "Forgot their password? Use **Set new password** in the user's menu. Someone leaving? **Deactivate** them; they are signed out at once.",
          },
        ],
      },
      {
        id: "roles",
        title: "Staff and roles",
        blocks: [
          {
            type: "table",
            head: ["Role", "Can do"],
            rows: [
              ["Owner", "Everything, in every branch"],
              [
                "Branch manager",
                "Billing, cancel bills and credit notes, approve discounts and dues, customers and old dues, stock and approvals, reports, audit log",
              ],
              ["Counter", "Billing, invoices and payments, customers, view stock"],
              ["Storekeeper", "Items, stock adjustments and transfers"],
              ["Accountant", "Dashboard, invoices and payments, view customers, reports"],
            ],
          },
          {
            type: "p",
            text: "In **Settings → Roles & permissions** you can change what each role may do, or create your own role.",
          },
        ],
      },
      {
        id: "billing-settings",
        title: "Billing & tax settings",
        blocks: [
          {
            type: "list",
            items: [
              "**Bill paper size**: A4, A5, 80 mm or 58 mm, used everywhere bills print.",
              "**Terms**, **Footer** and **Signature label** printed on bills.",
              "**Max discount without approval** (default 5%) and the **Default payment mode** at the POS.",
              "**Print right after charging**, and **Allow negative stock**.",
              "**Adjustment approval limit** for stock corrections.",
            ],
          },
        ],
      },
      {
        id: "numbers",
        title: "Bill numbers",
        blocks: [
          {
            type: "p",
            text: "**Settings → Number series** sets the prefix and digits for invoices (INV), credit notes (CN), adjustments, transfers and old dues, per branch. Numbers restart every financial year (April–March) and never skip. A series that is in use is locked until the next year.",
          },
        ],
      },
      {
        id: "audit",
        title: "Who changed what",
        blocks: [
          {
            type: "p",
            text: "**Settings → Audit log** lists sign-ins and changes to users, roles, branches, settings and customers, with who did it and when. Click **Changes** to see before and after.",
          },
        ],
      },
    ],
  },
  {
    id: "account",
    title: "Your account",
    intro: "Your profile and password.",
    articles: [
      {
        id: "password",
        title: "Change or reset your password",
        blocks: [
          {
            type: "list",
            items: [
              "Change it: click your initials → **My profile** → **Change password**. You are signed out on every device and log in again.",
              "Forgot it: on the login page click **Forgot password?** and enter your mobile number or email. The link in the email works for 30 minutes.",
              "No email on your account? Ask the owner to set a new password from **Settings → Users**.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Common messages",
    intro: "What a message means and what to do.",
    articles: [
      {
        id: "messages",
        title: "Messages you may see",
        blocks: [
          {
            type: "table",
            head: ["Message", "What to do"],
            rows: [
              [
                "Your shop is waiting for approval",
                "Your registration is being checked. You'll get an email when it's active.",
              ],
              [
                "Too many attempts. Please try again in N minute(s).",
                "Too many wrong passwords. Wait for the time shown, or ask the owner to set a new password.",
              ],
              ["Open a shift to start billing", "Count the drawer and click Open shift."],
              ["Pay later is greyed out", "Add the customer to the bill first (F7)."],
              [
                "Manager approval needed",
                "The discount or dues are above the limit. Ask a manager to sign in on the box.",
              ],
              ["Only N available", "Not enough stock in this branch. Check the item's stock, or ask a manager."],
              [
                "This invoice has credit notes, so it can't be cancelled",
                "Return the remaining items with another credit note.",
              ],
              ["Adjustment awaiting approval", "It is worth more than the approval limit. A manager must approve it."],
              [
                "Something went wrong on this screen",
                "Click Try again. If it keeps happening, tell your administrator what you were doing.",
              ],
            ],
          },
        ],
      },
    ],
  },
];
