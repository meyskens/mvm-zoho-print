function initializeWidget() {
	/*
	 * Subscribe to the EmbeddedApp onPageLoad event before initializing the widget 
	 */
	ZOHO.embeddedApp.on("PageLoad",function(data) {
		$('#nodata-alert').alert('close')
		$('#print-progress').hide();
	})
	/*
	 * initialize the widget.
	 */
	ZOHO.embeddedApp.init();
}

async function printAllInschrijving() {
	$('#print-progress').show();
	setProgress(10)
	const doc = new jsPDF({
		orientation: 'p',
		unit: 'mm',
		format: 'a4',
	})

	let loadMore = true;
	let page = 1;

	const entriesToPrint = [];

	while (loadMore) {
		if (page*4 < 80) { // don't let it go over 80 TODO: find a better hack
			setProgress(10 + page*4); 
		}
		const data = await ZOHO.CRM.API.getAllRecords({Entity:"Inschrijvingen",sort_order:"asc",per_page:100,page});
		if (data.status == 204) { // no more content
			loadMore = false;
			break;
		}
		for (let entry of data.data) {
			if (!entry.Klant) {
				continue;
			}
			const fullEntry = await ZOHO.CRM.API.getRecord({Entity:"Inschrijvingen",RecordID:entry.id})
			const account = await ZOHO.CRM.API.getRecord({Entity:"Accounts",RecordID:entry.Klant.id})
			await waitForRateLimit();

			const naam = fullEntry.data[0].Naam;
			const nummer = fullEntry.data[0].Doelgroep_Nummer;
			const kinderenSnoep = account.data[0].Aantal_15;
			const kinderenKomt = [];

			for (let kind of fullEntry.data[0].Kinderen) {
				if (kind.Komt) {
					kinderenKomt.push(`${kind.Naam}: ${kind.Geslacht} ${kind.Leeftijd} jaar`);
				}
			}

			if (kinderenKomt.length > 0) {
				entriesToPrint.push({
					nummer,
					naam,
					kinderenSnoep,
					kinderenKomt,
				})
				console.log(kinderenKomt)
			}
		}
		
		page++;
	}
	setProgress(95);
	entriesToPrint.sort(function(a,b){ // sort by MVM number
		let aa = a
		if (a && a.naam && a.naam.replace) {
			aa = parseInt(a.naam.replace("MVM",""));
		}
		let bb = b
		if (b && b.naam && b.naam.replace) {
			bb = parseInt(b.naam.replace("MVM",""));
		}

		return aa-bb;
	})
	let pdfOffset = 0;
	for (let entry of entriesToPrint) {
		doc.setFontSize(40);
		doc.text(30, 30+pdfOffset, entry.nummer);

		doc.setFontSize(20);
		doc.text(30, 40+pdfOffset, entry.naam);

		let lineOffset = 0;
		for (let line of entry.kinderenKomt) {
			doc.text(30, 60+pdfOffset+lineOffset, line);
			lineOffset += 10;
		}

		doc.text(30, 60+pdfOffset+lineOffset+20, `snoep: ${entry.kinderenSnoep} kinderen`);

		if (pdfOffset != 0) {
			doc.addPage("a4", "p");
			pdfOffset = 0;
		} else {
			pdfOffset= 150; // 2nd half of page
		}
	}
	doc.save("inschrijvingen.pdf");
	setProgress(100);
	$('#print-progress').hide();
}

function setProgress(amount) {
	$('#print-progress>.progress-bar').css("width", `${amount}%`);
	$('#print-progress>.progress-bar').text(`${amount}%`);
}

function waitForRateLimit() {
	return new Promise(function(resolve){
		setTimeout(resolve, 1500);
	})
}