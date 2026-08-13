import {describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import requestBundle from '../../../../tests/fixtures/bundles/request.valid.json';
import {NewSessionPage} from './NewSessionPage';

vi.mock('./RequestPreparationWorkspace',()=>({RequestPreparationWorkspace:({onBundleReady}:{onBundleReady:(bundle:typeof requestBundle,name:string)=>void})=><button onClick={()=>onBundleReady(requestBundle,'request_bundle.json')}>Finish mocked workspace</button>}));
const jsonFile=(name:string,value:unknown)=>{const text=JSON.stringify(value);return Object.assign(new File([text],name,{type:'application/json'}),{text:async()=>text})};
const renderPage=()=>render(<MemoryRouter><NewSessionPage/></MemoryRouter>);

describe('NewSessionPage request bundle entry points',()=>{
  it('keeps direct ready request-bundle import',async()=>{renderPage();const heading=screen.getByRole('heading',{name:'У меня уже есть готовый request bundle'});expect(heading).toBeVisible();const input=heading.parentElement!.querySelector('input') as HTMLInputElement;fireEvent.change(input,{target:{files:[jsonFile('request_bundle.json',requestBundle)]}});expect(await screen.findByRole('heading',{name:'4. Проверьте заявку'})).toBeVisible();expect(screen.getByRole('heading',{name:'5. Выберите каталоги'})).toBeVisible();expect(screen.getByRole('heading',{name:'6. Создайте черновик'})).toBeVisible()},15000);
  it('accepts bundle produced by preparation workspace',async()=>{const user=userEvent.setup();renderPage();await user.click(screen.getByRole('button',{name:'Finish mocked workspace'}));expect(await screen.findByRole('heading',{name:'4. Проверьте заявку'})).toBeVisible();expect(screen.getByText(/request_bundle.json/)).toBeVisible();expect(screen.queryByRole('button',{name:'Finish mocked workspace'})).not.toBeInTheDocument()});
});
