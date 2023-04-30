const readline = require('readline');
const TurndownService = require('turndown');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Enter the URL: ', async url => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    const html = await page.content();

    const $ = cheerio.load(html);

    // Remove any <style> or <link> elements
    $('style, link[rel="stylesheet"]').remove();

    // Remove any <script> elements
    $('script').remove();

    $('head').remove();

    // Set the max-width of the body element to 66%
    $('head').append('<style>body { max-width: 66%; }</style>');


    // Get the original width and height of each <img> element and add the attributes to the element
    $('img').each((index, element) => {
        const width = $(element).attr('width') || $(element).prop('width') || undefined;
        const height = $(element).attr('height') || $(element).prop('height') || undefined;
        $(element).attr({ width, height });
    });

    const turndownService = new TurndownService();
    const markdown = turndownService.turndown($.html());


    let title = html.match(/<title[^>]*>([^<]+)<\/title>/)[1]; // extract the webpage title
    title = sanitizeFileName(title);
    const folderPath = path.join('pages', title);
    const filename = `${title}.md`;
    const markdownFilePath = path.join(folderPath, filename);

    // Create the folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }

    const screenshotPath = path.join(folderPath, `${title}.png`);
    const pdfPath = path.join(folderPath, `${title}.pdf`);

    try {
        console.log('Waiting for pdf generation.')
        // Write screenshot and pdf
 
        await page.pdf({ path: pdfPath, format: 'A4' });
        console.log('Pdf saved.');
        // await page.screenshot({ path: screenshotPath, fullPage: true });
        // console.log('Screenshot saved.');
    } catch (error) {
        console.log('Error:', error.message || 'Error while screenshot/pdf generation.')
        if (!fs.existsSync(pdfPath)) {
            console.log('Retrying pdf generation with sleep period of 5 minute.');
            await sleep(5 * 60 * 1000);
            await page.pdf({ path: pdfPath, format: 'A4' });
            console.log('Pdf saved.');
        }
        // if (!fs.existsSync(screenshotPath)) {
        //     console.log('Retrying screenshot generation with sleep period of 1 minute.');
        //     await sleep(60 * 1000);
        //     await page.screenshot({ path: screenshotPath, fullPage: true });
        //     console.log('Screenshot saved.');
        // }

    } finally {
        await browser.close();
    }



    // Write the Markdown to a local file
    fs.writeFile(markdownFilePath, markdown, err => {
        if (err) {
            console.error(err);
        } else {
            console.log(`Markdown saved.`);
        }
        rl.close();
    });
});


function sanitizeFileName(name) {
    // Remove any characters that are not allowed in file names on Ubuntu, Windows, or macOS
    return name.replace(/[^\w\d\s\-_.]/gi, '_');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
