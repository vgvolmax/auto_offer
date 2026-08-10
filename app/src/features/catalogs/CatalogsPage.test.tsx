import {beforeEach,describe,expect,it} from 'vitest';
import {render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import mixedCatalog from '../../../../tests/fixtures/bundles/catalog.mixed.json';
import {resetDatabaseConnection} from '../../storage/database';
import {catalogsRepository} from '../../storage/catalogs-repository';
import {CatalogsPage} from './CatalogsPage';

beforeEach(async()=>{
  resetDatabaseConnection();
  await new Promise<void>(resolve=>{
    const request=indexedDB.deleteDatabase('auto-offer');
    request.onsuccess=()=>resolve();
  });
});

describe('CatalogsPage mixed catalog regression',()=>{
  it('accepts, persists, and restores mixed item status counters',async()=>{
    const contents=JSON.stringify(mixedCatalog);
    const file=new File([contents],'catalog.mixed.json',{type:'application/json'});
    Object.defineProperty(file,'text',{value:async()=>contents});
    const user=userEvent.setup();
    const firstView=render(<MemoryRouter><CatalogsPage/></MemoryRouter>);

    await user.upload(firstView.container.querySelector('input[type="file"]') as HTMLInputElement,file);

    await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Завершено'));
    const firstCard=screen.getByRole('article');
    expect(firstCard).toHaveTextContent('4 позиций · 1 validated · 1 needs_review · 2 не участвуют в подборе (1 unsupported, 1 invalid)');
    const saved=await catalogsRepository.all();
    expect(saved).toHaveLength(1);
    expect(saved[0].bundle).toEqual(mixedCatalog);

    firstView.unmount();
    resetDatabaseConnection();
    render(<MemoryRouter><CatalogsPage/></MemoryRouter>);

    const restoredCard=await screen.findByRole('article');
    expect(within(restoredCard).getByRole('heading',{name:'synthetic-valves'})).toBeVisible();
    expect(restoredCard).toHaveTextContent('4 позиций · 1 validated · 1 needs_review · 2 не участвуют в подборе (1 unsupported, 1 invalid)');
    expect(await catalogsRepository.all()).toHaveLength(1);
  });
});
