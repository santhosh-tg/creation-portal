import { ActionService } from './../../../core/services/action/action.service';
import { HelperService } from './../../../sourcing/services/helper.service';
import { TranscriptService } from './../../../core/services/transcript/transcript.service';
import { SourcingService } from './../../../sourcing/services/sourcing/sourcing.service';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { EMPTY, forkJoin, observable, Observable, of, throwError } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';
import _, { forEach } from 'lodash';
import { TranscriptMetadata } from './transcript';
import { SearchService } from '@sunbird/core';
import { ActivatedRoute } from '@angular/router';

// import { ToasterService } from 'src/app/modules/shared';

@Component({
  selector: 'app-transcripts',
  templateUrl: './transcripts.component.html',
  styleUrls: ['./transcripts.component.scss']
})

export class TranscriptsComponent implements OnInit {
  @Input() contentMetaData;
  @Output() closePopup = new EventEmitter<any>();
  public orderForm: FormGroup;
  public transcriptForm: FormGroup;
  public langControl = "language";
  public languageOptions;
  public assetList = [];
  public loader = true;
  public disableDoneBtn = true;

  // @Todo -> contributor/ sourcing reviewer/ contribution reviewer/ sourcing admin/ contribution org admin
  public userRole = "contributor";

  constructor(private fb: FormBuilder,
    private cd: ChangeDetectorRef,
    private sourcingService: SourcingService,
    private transcriptService: TranscriptService,
    private helperService: HelperService,
    private searchService: SearchService,
    private actionService : ActionService,
    public activeRoute: ActivatedRoute
    // private toasterService: ToasterService
  ) { }

  ngOnInit(): void {
    this.showLoader();
    this.languageOptions = [
      "English",
      "Hindi",
      "Assamese",
      "Bengali",
      "Gujarati",
      "Kannada",
      "Malayalam",
      "Marathi",
      "Nepali",
      "Odia",
      "Punjabi",
      "Tamil",
      "Telugu",
      "Urdu",
      "Sanskrit",
      "Maithili",
      "Munda",
      "Santali",
      "Juang",
      "Ho",
    ];

    this.transcriptForm = this.fb.group({
      items: this.fb.array([])
    });

    this.contentRead(this.contentMetaData.identifier).subscribe(content => {
      this.hideLoader();
      this.contentMetaData.transcripts = _.get(content, 'transcripts') || [];
      if (this.contentMetaData.transcripts.length) {
        this.setFormValues(this.contentMetaData.transcripts);
      }
      this.addItem();
    })

    this.getAssetList();
  }

  get items(): FormArray {
    return this.transcriptForm.get('items') as FormArray;
  }

  getLanguage(index) {
    return this.items.controls[index].get("language").value;
  }

  getFileControl(index) {
    return this.items.controls[index].get("transcriptFile");
  }

  getFileNameControl(index) {
    return this.items.controls[index].get("fileName");
  }

  getLanguageControl(index) {
    return this.items.controls[index].get("language");
  }

  setFile(index, value) {
    return this.items.controls[index].get("transcriptFile")["file"] = value;
  }

  getFile(index) {
    return this.items.controls[index].get("transcriptFile")["file"];
  }

  addItem(data?): void {
    this.items.push(this.createItem(data));
  }

  createItem(data?): FormGroup {
    return this.fb.group({
      identifier: [data ? data.identifier : null],
      language: [data ? data.language : null],
      transcriptFile: '',
      fileName: [data ? data.artifactUrl.split('/').pop() : null]
    });
  }

  get transcripts() {
    return this.transcriptForm.get('transcripts') as FormArray;
  }

  get languages() {
    return this.transcriptForm.get('languages') as FormArray;
  }

  attachFile(event, index) {
    const file = event.target.files[0];

    if (!this.fileValidation(file)) {
      return false;
    }

    if (event.target.files && event.target.files.length) {
      const [file] = event.target.files;
      this.setFile(index, file);
      this.getFileNameControl(index).patchValue(file.name)
    }
  }

  fileValidation(file) {
    // 1. File format validation
    // 2. file size validation
    return true;
  }

  replaceFile(index) {
    document.getElementById("attachFileInput" + index).click();
  }

  reset(index) {
    this.getFileControl(index).reset();
    this.getFileNameControl(index).reset();
  }

  download(identifier) {
    // @Todo - handle error
    const item = _.find(this.contentMetaData.transcripts, e => e.identifier == identifier);
    if (_.get(item, 'artifactUrl')) {
      window.open(_.get(item, 'artifactUrl'), '_blank');
    } else {
      // this.toasterService.error('Something went wrong');
    }
  }

  setFormValues(transcriptsMeta) {
    transcriptsMeta.forEach((element) => {
      this.addItem(element);
    });
  }

  languageChange(language, index) {
    if (language) {
      forEach(this.items.controls, (e, i) => {
        if (e.get("language").value && i !== index) {
          if (e.get("language").value === language) {
            this.items.controls[index].get("language").reset();
            // @Todo - remove comment
            // this.toasterService.warning(language + ' is already selected');
            return true;
          }
        }
      })
    }
  }

  done() {
    this.disableDoneBtn = true;
    const transcriptMeta = [];
    const assetRequest = [];

    this.items['controls'].forEach((item) => {
      let transcriptMetadata: TranscriptMetadata = {};
      let orgAsset;
      if (item.get("identifier").value) {
        orgAsset = _.find(this.assetList, e => e.identifier == item.get("identifier").value);
      }

      if (item.get("fileName").value && item.get("language").value) {
        let forkReq;
        if (item.get("transcriptFile")['file']) {
          forkReq = this.createOrUpdateAsset(item).pipe(
            switchMap(asset => {
              transcriptMetadata.language = item.get("language").value;
              transcriptMetadata.identifier = _.get(asset, 'result.identifier');
              return this.generatePreSignedUrl(asset, item);
            }),
            switchMap((rsp) => {
              item['preSignedResponse'] = rsp;
              const signedURL = item['preSignedResponse'].result.pre_signed_url;
              transcriptMetadata.artifactUrl = signedURL.split('?')[0];
              transcriptMeta.push(transcriptMetadata);
              return this.uploadToBlob(rsp, item);
            }),
            switchMap(response => {
              return this.updateAssetWithURL(item);
            })
          );
        } else {
          // Update only asset language only
          forkReq = this.createOrUpdateAsset(item).pipe(switchMap((rs) => {
            transcriptMetadata.identifier = _.get(orgAsset, 'identifier');
            transcriptMetadata.language = item.get("language").value;
            transcriptMetadata.artifactUrl = _.get(orgAsset, 'artifactUrl');
            transcriptMeta.push(transcriptMetadata);
            return of(transcriptMetadata);
          }));
        }
        assetRequest.push(forkReq);
      }
    });

    forkJoin(assetRequest).subscribe(response => {
      this.updateContent(transcriptMeta).subscribe(response => {
        this.closePopup.emit();
      }, error => {
        this.closePopup.emit();
        console.log("Something went wrong", error);
      });
    }, error => {
      console.log(error);
    });
  }

  createOrUpdateAsset(item): Observable<any> {
    const identifier = item.get("identifier").value;
    const req = _.clone(this.createAssetReq);
    req.asset['name'] = item.get("fileName").value;
    req.asset['language'].push(item.get("language").value);

    if (identifier) {
      const asset = _.find(this.assetList, em => em.identifier == identifier);
      req.asset['versionKey'] = _.get(asset, 'versionKey');
      return this.sourcingService.updateAsset(req, identifier);
    } else {
      return this.sourcingService.createAsset(req);
    }
  }

  uploadToBlob(response, item): Observable<any> {
    try {
      const signedURL = response.result.pre_signed_url;
      const config = {
        processData: false,
        contentType: 'Asset',
        headers: {
          'x-ms-blob-type': 'BlockBlob'
        }
      };

      return this.transcriptService.http.put(signedURL, item.get("transcriptFile")['file'], config);
    } catch (err) {
      console.log(err);
    }
  }

  generatePreSignedUrl(asset, item): Observable<any> {
    try {
      const req = {
        "content": {
          "fileName": item.get("fileName").value
        }
      };
      return this.sourcingService.generatePreSignedUrl(req, _.get(asset, 'result.identifier'));
    } catch (err) {
      throw err;
    }
  }

  updateAssetWithURL(item): Observable<any> {
    const signedURL = item['preSignedResponse'].result.pre_signed_url;
    const fileURL = signedURL.split('?')[0];
    var formData = new FormData();
    formData.append("fileUrl", fileURL);
    formData.append("mimeType", "application/x-subrip");

    const request = {
      data: formData
    };

    return this.sourcingService.uploadAsset(request, item['preSignedResponse'].result.identifier);
  }

  updateContent(transcriptMeta): Observable<any> {
    const req = {
      content: {
        versionKey: this.contentMetaData.versionKey,
        transcripts: transcriptMeta
      }
    };

    return this.helperService.updateContent(req, this.contentMetaData.identifier);
  }

  get createAssetReq() {
    return {
      "asset": {
        "name": "",
        "mimeType": "application/x-subrip",
        "primaryCategory": "Video transcript",
        "mediaType": "text",
        "language": []
      }
    }
  }

  getAssetList(): void {
    const transcripts = _.get(this.contentMetaData, "transcripts") || [];
    const identifier = _.map(transcripts, e => e.identifier);
    if (identifier && identifier.length) {
      const req = {
        "filters": {
          "primaryCategory": "Video transcript",
          "status": [],
          "identifier": identifier
        },
        "fields": ["versionKey"]
      };

      this.searchService.compositeSearch(req).subscribe(res => {
        this.hideLoader();
        this.disableDoneBtn = false;
        if (_.get(res, "responseCode") === "OK") {
          this.assetList = _.get(res, 'result.content');
        }
      }, err => {
        console.log("Something went wrong", err);
      });
    } else {
      this.hideLoader();
      this.disableDoneBtn = false;
    }
  }

  contentRead(identifier): Observable<any> {
    const option = {
      url: 'content/v3/read/' + identifier
    };
    return this.actionService.get(option).pipe(map((data: any) => data.result.content), catchError(err => {
      const errInfo = {
        errorMsg: 'Unable to read the Content, Please Try Again',
        telemetryPageId: "",
        telemetryCdata: "",
        env: this.activeRoute.snapshot.data.telemetry.env,
        request: option
      };
      return throwError(this.sourcingService.apiErrorHandling(err, errInfo));
    }));
  }

  showLoader(): void {
    this.loader = true;
  }

  hideLoader(): void {
    this.loader = false;
  }

  close() {
    this.closePopup.emit();
  }
}
