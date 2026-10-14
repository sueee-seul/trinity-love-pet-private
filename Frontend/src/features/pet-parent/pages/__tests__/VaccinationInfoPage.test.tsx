import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VaccinationInfoPage } from '../VaccinationInfoPage';
import { ApiError } from '../../api/bookingApi';
import {
  fetchVaccination,
  saveVaccination,
  vaccinationCertificateUrl,
} from '../../api/vaccinationApi';
import type { VaccinationDetail } from '../../types/vaccination';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { englishWordsIn } from '../../../../shared/i18n/testing/englishWordsIn';

vi.mock('../../api/vaccinationApi', () => ({
  fetchVaccination: vi.fn(),
  saveVaccination: vi.fn(),
  vaccinationCertificateUrl: vi.fn(
    (id: string) => `http://api.test/api/petparent/vaccination/${id}/certificate`,
  ),
}));

const UPLOADED_AT = new Date(2026, 8, 2, 12).toISOString();

const detail: VaccinationDetail = {
  bookingPetId: 'bp-max',
  petName: 'Max',
  fullyVaccinated: null,
  dropOffAt: new Date(2026, 8, 12, 9).toISOString(),
  pickUpAt: new Date(2026, 8, 16, 9).toISOString(),
  serviceType: 'Overnight boarding',
  certificate: null,
  canChange: true,
  otherPets: [],
};

const withCertificate: VaccinationDetail = {
  ...detail,
  fullyVaccinated: true,
  certificate: { uploadedAt: UPLOADED_AT },
};

const pdfFile = (name = 'max-vaccinations.pdf'): File =>
  new File(['%PDF-1.7'], name, { type: 'application/pdf' });

const renderPage = (bookingPetId = 'bp-max'): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={[`/parent/vaccination/${bookingPetId}`]}>
      <Routes>
        <Route path="/parent/vaccination/:bookingPetId" element={<VaccinationInfoPage />} />
      </Routes>
    </MemoryRouter>,
  );

const loaded = (): Promise<HTMLElement> =>
  screen.findByText('For Max · 12 to 16 Sep · Overnight boarding');

// userEvent would otherwise drop a file the picker's `accept` rules out before the page sees it;
// these tests check the page's own messages.
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ applyAccept: false });

beforeEach(() => {
  vi.mocked(fetchVaccination).mockReset();
  vi.mocked(saveVaccination).mockReset();
});

afterEach(() => {
  useConciergeStore.getState().setLocale('en');
});

describe('VaccinationInfoPage', () => {
  it('starts at No with nothing provided: the pet is kept apart and there is nothing to save', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue(detail);
    renderPage();

    expect(screen.getByText('Loading vaccination information…')).toBeInTheDocument();
    await loaded();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Vaccination information' }),
    ).toBeVisible();
    expect(screen.getByText('Not provided yet')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'No' })).toBeChecked();
    expect(
      screen.getByRole('heading', { name: 'Max will be kept apart from other pets' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Minimum Standards\s+4\(c\) and 6\(a\)/)).toBeInTheDocument();
    // The Code sets the rule, but which vaccines count is Wagstay's, and the page says so.
    expect(
      screen.getByText(/What counts as fully vaccinated \(C5 for dogs, F3 for cats\) is our own/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/It is not a Wagstay rule/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Upload certificate/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View certificate/ })).not.toBeInTheDocument();
  });

  it('asks for the certificate on Yes and keeps Save off until a file is chosen', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue(detail);
    renderPage();
    await loaded();

    await user().click(screen.getByRole('radio', { name: 'Yes' }));

    expect(screen.getByLabelText(/Upload certificate/)).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('The date each vaccine was given')).toBeInTheDocument();
    expect(screen.getByText('When each vaccine is next due')).toBeInTheDocument();
    expect(
      screen.getByText('Our staff check the certificate when you drop Max off.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Upload the certificate to save.')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Max will be kept apart from other pets' }),
    ).not.toBeInTheDocument();
  });

  it('rejects a file type the picker does not take and never attaches it', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue(detail);
    renderPage();
    await loaded();
    const actor = user();
    await actor.click(screen.getByRole('radio', { name: 'Yes' }));

    await actor.upload(
      screen.getByLabelText(/Upload certificate/),
      new File(['hello'], 'notes.txt', { type: 'text/plain' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unsupported file type. Please upload a PDF, JPG, JPEG, PNG or HEIC file.',
    );
    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('rejects a file over 10 MB', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue(detail);
    renderPage();
    await loaded();
    const actor = user();
    await actor.click(screen.getByRole('radio', { name: 'Yes' }));
    const big = pdfFile('big.pdf');
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 });

    await actor.upload(screen.getByLabelText(/Upload certificate/), big);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This file is larger than 10 MB. Please upload a smaller file.',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves Yes with the chosen file and then shows the upload date', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue(detail);
    vi.mocked(saveVaccination).mockResolvedValue(withCertificate);
    renderPage();
    await loaded();
    const actor = user();
    await actor.click(screen.getByRole('radio', { name: 'Yes' }));
    const file = pdfFile();

    await actor.upload(screen.getByLabelText(/Upload certificate/), file);
    expect(screen.getByText('max-vaccinations.pdf')).toBeInTheDocument();
    await actor.click(screen.getByRole('button', { name: 'Save' }));

    expect(saveVaccination).toHaveBeenCalledWith('bp-max', {
      fullyVaccinated: true,
      certificate: file,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Vaccination information saved.');
    expect(screen.getByText('Uploaded 2 Sep')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View certificate/ })).toHaveAttribute(
      'href',
      'http://api.test/api/petparent/vaccination/bp-max/certificate',
    );
    expect(vaccinationCertificateUrl).toHaveBeenCalledWith('bp-max');
  });

  it('shows the server reason when a save is refused', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue(detail);
    vi.mocked(saveVaccination).mockRejectedValue(
      new ApiError('Upload a PDF, JPG, PNG or HEIC file', 422, {
        error: {
          code: 'VACCINATION_FILE_UNSUPPORTED',
          message: 'Upload a PDF, JPG, PNG or HEIC file',
        },
      }),
    );
    renderPage();
    await loaded();
    const actor = user();
    await actor.click(screen.getByRole('radio', { name: 'Yes' }));
    await actor.upload(screen.getByLabelText(/Upload certificate/), pdfFile('renamed.pdf'));

    await actor.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unsupported file type. Please upload a PDF, JPG, JPEG, PNG or HEIC file.',
    );
    expect(screen.getByText('Not provided yet')).toBeInTheDocument();
  });

  it('opens on Yes with the uploaded date and a way to replace the file', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue(withCertificate);
    renderPage();
    await loaded();

    expect(screen.getByText('Uploaded 2 Sep')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked();
    expect(screen.getByText(/You uploaded a certificate on 2 Sep/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Upload a new certificate/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('lets No take back a certificate on file', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue(withCertificate);
    vi.mocked(saveVaccination).mockResolvedValue({
      ...detail,
      fullyVaccinated: false,
    });
    renderPage();
    await loaded();
    const actor = user();

    await actor.click(screen.getByRole('radio', { name: 'No' }));
    expect(screen.getByText('Saving No removes the certificate you uploaded.')).toBeInTheDocument();
    await actor.click(screen.getByRole('button', { name: 'Save' }));

    expect(saveVaccination).toHaveBeenCalledWith('bp-max', { fullyVaccinated: false });
    expect(await screen.findByText('Not provided yet')).toBeInTheDocument();
  });

  it('shows what is on file but no form once check-in time has passed', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue({ ...withCertificate, canChange: false });
    renderPage();
    await loaded();

    expect(
      screen.getByText(/check-in time has passed, so this can no longer be changed here/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View certificate/ })).toBeInTheDocument();
  });

  it('tells the parent at collection what is kept, who sees it and how to correct it', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue(detail);
    renderPage();
    await loaded();

    const notice = within(
      screen.getByRole('complementary', { name: 'How we handle this certificate' }),
    );
    expect(notice.getByText(/We collect the certificate you upload/)).toBeInTheDocument();
    expect(
      notice.getByText(/Only you and Wagstay staff can open the certificate/),
    ).toBeInTheDocument();
    expect(notice.getByText(/It never has a public link/)).toBeInTheDocument();
    expect(notice.getByText(/You can ask to see or correct it at any time/)).toBeInTheDocument();
    expect(notice.getByText(/upload a new file here before check-in/)).toBeInTheDocument();
  });

  it('stops suggesting an upload in the notice once check-in has passed', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue({ ...withCertificate, canChange: false });
    renderPage();
    await loaded();

    const notice = within(
      screen.getByRole('complementary', { name: 'How we handle this certificate' }),
    );
    expect(notice.getByText(/To correct it now, please ask our team/)).toBeInTheDocument();
    expect(notice.queryByText(/upload a new file here/)).not.toBeInTheDocument();
  });

  it("names the vaccines as Wagstay's own requirement, not the law", async () => {
    vi.mocked(fetchVaccination).mockResolvedValue(detail);
    renderPage();
    await loaded();

    expect(
      screen.getByText(
        'Wagstay asks for C5 vaccination for dogs and F3 for cats. This is our own requirement, not a law.',
      ),
    ).toBeInTheDocument();
  });

  it('lists other pets on the booking, linking only the ones still needing a certificate', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue({
      ...detail,
      otherPets: [
        {
          bookingPetId: 'bp-luna',
          petName: 'Luna',
          fullyVaccinated: true,
          certificateUploadedAt: UPLOADED_AT,
        },
        {
          bookingPetId: 'bp-rex',
          petName: 'Rex',
          fullyVaccinated: true,
          certificateUploadedAt: null,
        },
      ],
    });
    renderPage();

    await screen.findByRole('heading', { name: 'Other pets on this booking' });
    expect(screen.getByText(/Certificate received 2 Sep/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Luna/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Rex: Certificate needed/ })).toHaveAttribute(
      'href',
      '/parent/vaccination/bp-rex',
    );
  });

  it('shows a not-found message and lets the pet parent retry', async () => {
    vi.mocked(fetchVaccination).mockRejectedValue(new ApiError('Not found', 404, null));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not find that stay.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('links back to the home page', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue(detail);
    renderPage();
    await loaded();
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('href', '/parent');
  });

  it('keeps one page title and gives every section the same heading level', async () => {
    vi.mocked(fetchVaccination).mockResolvedValue({
      ...detail,
      otherPets: [
        {
          bookingPetId: 'bp-rex',
          petName: 'Rex',
          fullyVaccinated: null,
          certificateUploadedAt: null,
        },
      ],
    });
    renderPage();
    await loaded();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      'Proof for this stay',
      'Why we ask',
      'The rules we follow',
      'Other pets on this booking',
    ]);
  });
});

describe('VaccinationInfoPage in Chinese', () => {
  it('shows the page, the Code of Welfare notice and the privacy notice in Chinese', async () => {
    useConciergeStore.getState().setLocale('zh');
    vi.mocked(fetchVaccination).mockResolvedValue(detail);
    renderPage();

    expect(screen.getByText('正在加载疫苗信息…')).toBeInTheDocument();
    await screen.findByText('宠物：Max · 9月12日至16日 · 过夜寄养');
    expect(screen.getByRole('heading', { level: 1, name: '疫苗信息' })).toBeVisible();
    expect(screen.getByText('尚未提供')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '否' })).toBeChecked();
    expect(screen.getByRole('heading', { name: 'Max 会和其他宠物分开安置' })).toBeInTheDocument();
    // The standard numbers and vaccine names stay exactly as the Code and Wagstay give them.
    expect(screen.getByText(/最低标准 4\(c\) 和 6\(a\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/怎样才算完成全部疫苗接种（狗狗 C5，猫咪 F3）是我们自己的标准/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Wagstay 要求狗狗接种 C5 疫苗，猫咪接种 F3 疫苗。这是我们自己的要求，不是法律规定。',
      ),
    ).toBeInTheDocument();
    const notice = within(screen.getByRole('complementary', { name: '我们如何处理这份证书' }));
    expect(notice.getByText(/只有你和 Wagstay 员工可以打开这份证书/)).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['这次住宿的疫苗证明', '我们为什么要问', '我们遵守的规定']);
    expect(englishWordsIn(document.body, ['Max'])).toEqual([]);
  });

  it('keeps a file message in step with the language when the parent switches back', async () => {
    useConciergeStore.getState().setLocale('zh');
    vi.mocked(fetchVaccination).mockResolvedValue(detail);
    renderPage();
    await screen.findByText(/宠物：Max/);
    const actor = user();
    await actor.click(screen.getByRole('radio', { name: '是' }));
    expect(screen.getByText('必填')).toBeInTheDocument();

    await actor.upload(
      screen.getByLabelText(/上传证书/),
      new File(['hello'], 'notes.txt', { type: 'text/plain' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      '不支持这种文件类型。请上传 PDF、JPG、JPEG、PNG 或 HEIC 文件。',
    );
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();

    act(() => useConciergeStore.getState().setLocale('en'));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Vaccination information' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unsupported file type. Please upload a PDF, JPG, JPEG, PNG or HEIC file.',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('explains a missing stay in Chinese and offers a retry', async () => {
    useConciergeStore.getState().setLocale('zh');
    vi.mocked(fetchVaccination).mockRejectedValue(new ApiError('Not found', 404, null));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('找不到这次住宿。');
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /首页/ })).toHaveAttribute('href', '/parent');
  });
});
