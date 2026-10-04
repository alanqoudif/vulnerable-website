-- Deterministic synthetic seed + reset. All data is fictional.
create schema if not exists training;
revoke all on schema training from public, anon, authenticated;

create or replace function training.id(k text) returns uuid
language sql immutable as $$ select md5('nuqta-training:' || k)::uuid $$;

create or replace function training.seed() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  pw constant text := 'Welcome#2026';
  org_names text[] := array['Nuqta Technology Demo','Al Noor Logistics','Muscat Digital','Falcon Ventures'];
  slugs text[] := array['nuqta-demo','al-noor','muscat-digital','falcon-ventures'];
  domains text[] := array['nuqta-demo.test','alnoor-demo.test','muscatdigital-demo.test','falcon-demo.test'];
  inds text[] := array['Software','Logistics','Digital Agency','Venture Capital'];
  firsts text[] := array['Salim','Aisha','Khalid','Mariam','Yousuf','Layla','Hamad','Noor','Tariq','Fatima','Omar','Huda','Rashid','Amal','Zayed','Sara','Majid','Dana','Faris','Rania','Nasser','Lina','Badr','Maya'];
  lasts text[] := array['Harthi','Busaidi','Rawahi','Kindi','Balushi','Hinai','Siyabi','Lawati','Farsi','Maamari','Habsi','Shukaili','Mahrouqi','Ghafri','Wahaibi','Jabri','Zadjali','Riyami','Amri','Saadi','Qasmi','Abri','Nabhani','Badi'];
  titles text[] := array['Chief Operating Officer','Engineering Manager','Software Engineer','Business Analyst','Account Executive','Support Specialist'];
  proj_names text[] := array[
    'Mibyan Assistant Rollout','Customer Portal Redesign','Tender Response Automation','Data Platform Migration',
    'Fleet Tracking Dashboard','Warehouse Slotting Study','Customs Documentation Pipeline','Driver Mobile App',
    'Gulf Retail Brand Refresh','Campaign Analytics Suite','Website Relaunch','Content Calendar Q4',
    'Portfolio Reporting Hub','Due Diligence Workspace','Investor Updates Q3','Market Mapping Study'];
  cust_names text[] := array[
    'Gulf Petrochem Services','Sohar Port Services','Oman Retail Group','Bahla Healthcare',
    'Salalah Foods','Duqm Industrial Park','Nizwa Trading','Sur Marine Supplies',
    'Ruwi Boutique Hotels','Seeb Telecom Partners','Qurum Realty','Muttrah Cafe Chain',
    'Blue Dune Holdings','Wadi Capital Partners','Sands Fintech','Harbor Biotech'];
  doc_titles text[] := array['Statement of Work','Technical Proposal','Meeting Notes','Requirements Brief','Risk Register','Budget Summary','Tender Response Draft','Weekly Status'];
  proj_status text[] := array['Active','Review','Draft','Approved','Archived'];
  doc_status text[] := array['Draft','Shared','Reviewed','Archived'];
  inv_status text[] := array['Draft','Sent','Approved','Paid','Paid'];
  task_titles text[] := array['Collect requirements','Draft scope document','Review budget','Prepare kickoff deck','Validate data sources','Schedule stakeholder review','Update status report','QA walkthrough'];
  models text[] := array['mibyan-4.1','mibyan-fast','mibyan-reasoning'];
  kb_names text[] := array['Company Handbook','Product Documentation','Tender References'];
  kdoc_titles text[] := array['Onboarding Guide.pdf','Expense Policy.docx','Brand Voice Notes.txt','API Reference v2.pdf','Release Notes 4.1.txt','Integration Checklist.docx','Evaluation Criteria.pdf','Past Bid Summary.docx','Pricing Benchmarks.txt'];
  convo_titles text[] := array['Proposal intro paragraph','Summarize the SOW','Review Python import script','Tender research notes','Customer churn analysis'];
  sec_notes text[] := array['Hardware key enrolled','MFA reminder sent','Password rotated 2026-08','Travel notice filed','Contractor access review due'];
  chan text[] := array['general','projects','finance','support'];
  actions text[] := array['project.created','project.status_changed','invoice.approved','member.invited','api_key.created','document.shared','conversation.shared','customer.updated','knowledge.uploaded','invoice.sent'];
  o int; u int; i int; k int; d int; idx int; n int;
  oid uuid; uid uuid; adm uuid; mgr uuid; emp uuid;
  em text; rl text; pid uuid; cid uuid; did uuid; fid uuid; vid uuid; cvid uuid; kbid uuid; kdid uuid; akid uuid;
  plain text;
begin
  insert into ai_models(id,name,description,tier,context_window,price_per_1k,status) values
   ('mibyan-4.1','Mibyan 4.1','Balanced flagship model for drafting, analysis and coding.','flagship',128000,0.0120,'available'),
   ('mibyan-fast','Mibyan Fast','Low-latency model for summaries and quick answers.','fast',32000,0.0020,'available'),
   ('mibyan-reasoning','Mibyan Reasoning','Extended reasoning for research and multi-step tasks.','reasoning',200000,0.0300,'available'),
   ('partner-demo-large','Partner Demo Large','Fictional third-party demo model (not connected).','partner',64000,0.0200,'preview')
  on conflict (id) do update set name=excluded.name, description=excluded.description;
  insert into plans(id,name,price_monthly,seats,ai_tokens,description) values
   ('starter','Starter',0,5,500000,'For small teams getting started.'),
   ('team','Team',149,25,5000000,'Collaboration, Mibyan chat and API access.'),
   ('business','Business',499,100,25000000,'Advanced controls, audit log and priority support.'),
   ('enterprise','Enterprise',1999,1000,200000000,'Dedicated capacity and custom terms.')
  on conflict (id) do update set name=excluded.name;

  for o in 1..4 loop
    oid := training.id('org:'||o);
    insert into organizations(id,name,slug,industry,country,plan,credit_balance,billing_email,created_at)
    values (oid, org_names[o], slugs[o], inds[o], 'OM', (array['business','team','team','starter'])[o],
            (array[500,250,1200,300])[o], 'billing@'||domains[o], now() - interval '400 days');
  end loop;

  -- users, profiles, memberships
  for o in 1..4 loop
    oid := training.id('org:'||o);
    for u in 1..6 loop
      idx := (o-1)*6+u;
      uid := training.id('user:'||o||':'||u);
      em := lower(firsts[idx])||'.'||lower(lasts[idx])||'@'||domains[o];
      rl := case u when 1 then 'organization_admin' when 2 then 'manager' else 'employee' end;
      insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
        raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,
        email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token)
      values ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated',em,crypt(pw,gen_salt('bf')),now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name',firsts[idx]||' Al '||lasts[idx]),
        now(),now(),'','','','','','','','');
      insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
      values (gen_random_uuid(),uid,uid::text,jsonb_build_object('sub',uid::text,'email',em,'email_verified',true),'email',now(),now(),now());
      insert into profiles(id,email,full_name,title,phone,default_org_id,is_trainee,last_ip,security_notes)
      values (uid,em,firsts[idx]||' Al '||lasts[idx],
        case u when 1 then 'Chief Operating Officer' when 2 then 'Engineering Manager' else titles[3+(u%4)] end,
        '+968 9'||lpad((1000000+o*100000+u*1111)::text,7,'0'),oid,(u=3),
        '10.'||(20+o)||'.'||u||'.'||(10+idx), sec_notes[1+(idx%5)]);
      insert into organization_members(org_id,user_id,role,created_at) values (oid,uid,rl,now()-interval '300 days');
    end loop;
  end loop;
  -- hint on the sandbox tenant admin used by one investigation path
  update profiles set security_notes = 'Recovery: code-based reset enabled (4-digit)' where id = training.id('user:4:1');
  -- one consultant belongs to two organizations
  insert into organization_members(org_id,user_id,role) values (training.id('org:3'),training.id('user:2:6'),'employee');

  -- platform admin
  uid := training.id('user:platform');
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
    created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated','platform.admin@nuqta-demo.test',crypt(pw,gen_salt('bf')),now(),
    '{"provider":"email","providers":["email"]}','{"full_name":"Hessa Al Mughairi"}',now(),now(),'','','','','','','','');
  insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
  values (gen_random_uuid(),uid,uid::text,jsonb_build_object('sub',uid::text,'email','platform.admin@nuqta-demo.test','email_verified',true),'email',now(),now(),now());
  insert into profiles(id,email,full_name,title,platform_role,default_org_id,last_ip,security_notes)
  values (uid,'platform.admin@nuqta-demo.test','Hessa Al Mughairi','Platform Administrator','platform_admin',training.id('org:1'),'10.20.0.2','Hardware key enrolled');

  -- per-organization business data
  for o in 1..4 loop
    oid := training.id('org:'||o);
    adm := training.id('user:'||o||':1'); mgr := training.id('user:'||o||':2');

    for i in 1..4 loop  -- customers
      idx := (o-1)*4+i; cid := training.id('cust:'||o||':'||i);
      insert into customers(id,org_id,name,contact_name,email,phone,industry,status,annual_value,owner_id,notes,created_at)
      values (cid,oid,cust_names[idx],firsts[(idx%24)+1]||' Al '||lasts[((idx+7)%24)+1],
        'contact@'||regexp_replace(lower(cust_names[idx]),'[^a-z]+','','g')||'.test','+968 24'||lpad((100000+idx*7919)::text,6,'0'),
        (array['Energy','Retail','Healthcare','Hospitality'])[1+(i%4)], case when i=4 and o=3 then 'prospect' else 'active' end,
        (20000+idx*8750), mgr, 'Account notes for '||cust_names[idx]||'. Quarterly review scheduled.', now()-((idx*11)||' days')::interval);
    end loop;

    for i in 1..4 loop  -- projects, members, tasks, documents
      idx := (o-1)*4+i; pid := training.id('proj:'||o||':'||i);
      insert into projects(id,org_id,name,code,description,status,owner_id,customer_id,start_date,due_date,budget,created_at)
      values (pid,oid,proj_names[idx],upper(left(slugs[o],2))||'-'||(100+i),
        'Delivery of '||proj_names[idx]||' for the '||org_names[o]||' account team.',
        proj_status[1+((i+o-2)%5)], case when i%2=0 then mgr else adm end, training.id('cust:'||o||':'||i),
        current_date-(60+i*9), current_date+(15+i*21), 12000+idx*4300, now()-((70+i*9)||' days')::interval);
      insert into project_members(project_id,user_id,role) values (pid, mgr,'lead'),(pid,training.id('user:'||o||':'||(2+i)),'contributor'),(pid,training.id('user:'||o||':'||(3+(i%4))),'contributor') on conflict do nothing;
      for k in 1..5 loop
        insert into tasks(org_id,project_id,title,description,status,priority,assignee_id,due_date,created_at)
        values (oid,pid,task_titles[1+((k+i)%8)],'Task for '||proj_names[idx],(array['todo','in_progress','done'])[1+((k+i)%3)],
          (array['low','medium','high'])[1+((k*i)%3)], training.id('user:'||o||':'||(3+((k+i)%4))), current_date+(k*4-6), now()-((k*3)||' days')::interval);
      end loop;
      for k in 1..2 loop
        did := training.id('doc:'||o||':'||i||':'||k); fid := training.id('file:doc:'||o||':'||i||':'||k);
        insert into files(id,org_id,owner_id,bucket,path,name,mime_type,size_bytes,visibility,created_at)
        values (fid,oid,mgr,'documents',oid||'/'||did||'.txt',doc_titles[1+((idx+k)%8)]||'.txt','text/plain',2048+idx*k*97,'org',now()-((idx+k)||' days')::interval);
        insert into documents(id,org_id,project_id,title,summary,body,status,owner_id,file_id,created_at)
        values (did,oid,pid,doc_titles[1+((idx+k)%8)]||' - '||proj_names[idx],'Working document for '||proj_names[idx]||'.',
          E'Synthetic training document.\n\nPurpose: capture decisions for '||proj_names[idx]||E'.\nOwner: project lead. Revision history is tracked below.',
          doc_status[1+((idx+k)%4)], case when k=1 then mgr else training.id('user:'||o||':3') end, fid, now()-((idx*2+k)||' days')::interval);
        insert into document_versions(document_id,version,body,note,author_id,created_at)
        values (did,1,'First draft of '||proj_names[idx],'Initial draft',mgr,now()-((idx*2+k+9)||' days')::interval),
               (did,2,'Revised draft after review of '||proj_names[idx],'Incorporated feedback',mgr,now()-((idx*2+k+2)||' days')::interval);
      end loop;
    end loop;

    -- confidential board pack (synthetic) for the last org
    if o = 4 then
      fid := training.id('file:board'); did := training.id('doc:board');
      insert into files(id,org_id,owner_id,bucket,path,name,mime_type,size_bytes,visibility)
      values (fid,oid,adm,'documents',oid||'/'||did||'.txt','Board Pack Q3 - Confidential.txt','text/plain',4096,'private');
      insert into documents(id,org_id,title,summary,body,status,owner_id,file_id)
      values (did,oid,'Board Pack Q3 - Confidential','Restricted board material (synthetic).',
        E'SYNTHETIC CONFIDENTIAL TRAINING DATA\nFund allocation notes and partner shortlist.\nReference: TRAINING_SECRET_demo_12345',
        'Draft',adm,fid);
    end if;
    -- sensitive attachment export in the public attachments bucket (synthetic)
    if o = 2 then
      insert into files(id,org_id,owner_id,bucket,path,name,mime_type,size_bytes,visibility)
      values (training.id('file:payroll'),oid,adm,'attachments','exports/2026-09-payroll-summary.csv','2026-09-payroll-summary.csv','text/csv',1200,'private');
    end if;

    for i in 1..5 loop  -- invoices
      idx := (o-1)*5+i; vid := training.id('inv:'||o||':'||i);
      insert into invoices(id,org_id,number,customer_id,owner_id,status,currency,due_date,issued_at,created_at)
      values (vid,oid,upper(left(slugs[o],2))||'-'||(1040+idx),training.id('cust:'||o||':'||(1+(i%4))),
        case when i%2=0 then mgr else adm end, inv_status[i],'OMR',current_date+(30-i*12),current_date-(i*14),now()-((i*14)||' days')::interval);
      for k in 1..3 loop
        insert into invoice_items(invoice_id,description,quantity,unit_price,amount)
        values (vid,(array['Consulting hours','Platform subscription','Implementation package'])[k],k+i,(array[45,320,1250])[k],(k+i)*(array[45,320,1250])[k]);
      end loop;
      update invoices set subtotal=(select sum(amount) from invoice_items where invoice_id=vid),
        tax=round((select sum(amount) from invoice_items where invoice_id=vid)*0.05,2),
        total=round((select sum(amount) from invoice_items where invoice_id=vid)*1.05,2) where id=vid;
    end loop;

    for i in 1..2 loop  -- invitations
      insert into invitations(id,org_id,email,role,token,status,invited_by,expires_at,created_at)
      values (training.id('invite:'||o||':'||i),oid,'new.hire'||i||'@'||domains[o],'employee',
        'inv_'||substr(md5('invite-token:'||o||':'||i),1,24),case i when 1 then 'Sent' else 'Created' end,adm,now()+interval '14 days',now()-((i*3)||' days')::interval);
    end loop;

    for i in 1..8 loop  -- messages
      insert into messages(org_id,channel,sender_id,body,created_at) values
      (oid,chan[1+(i%4)],training.id('user:'||o||':'||(1+(i%6))),
       (array['Kickoff notes are in the shared folder.','Can someone review the proposal draft today?','Invoice run is scheduled for Thursday.','Customer asked for an updated timeline.','Great work on the release, thanks all.','Reminder: update your task statuses before standup.','New Mibyan model is available in the workspace.','Please confirm your availability for the review.'])[i],
       now()-((i*7)||' hours')::interval);
    end loop;

    for i in 1..5 loop  -- ai conversations
      cvid := training.id('conv:'||o||':'||i); uid := training.id('user:'||o||':'||(2+i%5));
      insert into ai_conversations(id,org_id,owner_id,title,model,visibility,share_token,created_at)
      values (cvid,oid,uid,convo_titles[i],models[1+(i%3)],(array['private','org','shared','private','private'])[i],
        case when i=3 then 'shr_'||substr(md5('share:'||o),1,20) end, now()-((i*5)||' days')::interval);
      insert into ai_messages(conversation_id,role,content,tokens,created_at) values
       (cvid,'user','Help me with: '||lower(convo_titles[i])||'.',24,now()-((i*5)||' days')::interval),
       (cvid,'assistant','Here is a structured first pass for "'||convo_titles[i]||E'". I can refine tone, length or add references on request.'||
         case when o=1 and i=3 then E'\n\nSources: [[kb:'||training.id('kdoc:1:3:1')||'|Evaluation Criteria.pdf]]' else '' end,
         180,now()-((i*5)||' days')::interval+interval '1 minute'),
       (cvid,'user','Make it more concise and add a next-steps list.',14,now()-((i*5)||' days')::interval+interval '5 minutes'),
       (cvid,'assistant','Updated version below with a three-point summary and next steps for the team.',120,now()-((i*5)||' days')::interval+interval '6 minutes');
    end loop;

    for i in 1..3 loop  -- knowledge
      kbid := training.id('kb:'||o||':'||i);
      insert into knowledge_bases(id,org_id,name,description,owner_id,visibility)
      values (kbid,oid,kb_names[i],'Reference collection: '||kb_names[i],mgr,case when i=3 then 'restricted' else 'org' end);
      for k in 1..3 loop
        kdid := training.id('kdoc:'||o||':'||i||':'||k); fid := training.id('file:kdoc:'||o||':'||i||':'||k);
        insert into files(id,org_id,owner_id,bucket,path,name,mime_type,size_bytes,visibility)
        values (fid,oid,mgr,'knowledge-files',oid||'/'||kbid||'/'||kdid||'.txt',kdoc_titles[(i-1)*3+k],
          case when kdoc_titles[(i-1)*3+k] like '%.pdf' then 'application/pdf' when kdoc_titles[(i-1)*3+k] like '%.docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' else 'text/plain' end,
          8000+k*1500,'org');
        insert into knowledge_documents(id,kb_id,org_id,file_id,title,summary,status,token_count,uploader_id,created_at)
        values (kdid,kbid,oid,fid,kdoc_titles[(i-1)*3+k],'Synthetic reference material: '||kdoc_titles[(i-1)*3+k],
          (array['Available','Available','Processing','Uploaded'])[1+((i+k)%4)],1200*k+i*300,mgr,now()-((i*k*3)||' days')::interval);
      end loop;
    end loop;

    for k in 1..3 loop  -- api keys, usage, logs
      akid := training.id('key:'||o||':'||k);
      plain := 'mb_test_'||substr(md5('key:'||o||':'||k),1,24);
      insert into api_keys(id,org_id,owner_id,name,prefix,key_hash,status,scopes,last_used_at,revoked_at,created_at)
      values (akid,oid,case k when 1 then adm else mgr end,(array['Production gateway','Staging experiments','Retired prototype'])[k],
        left(plain,12),encode(digest(plain,'sha256'),'hex'),case when k=3 then 'Revoked' else 'Active' end,
        case k when 1 then '{chat,knowledge}' else '{chat}' end::text[],now()-interval '2 hours',
        case when k=3 then now()-interval '40 days' end, now()-((k*45)||' days')::interval);
      if k < 3 then
        for d in 0..13 loop
          insert into api_usage(org_id,api_key_id,day,model,requests,input_tokens,output_tokens,cost)
          values (oid,akid,current_date-d,models[1+((d+k)%3)],120+((d*37+k*11+o*5)%260),
            40000+((d*7919+o*1000)%60000),22000+((d*4457+k*500)%30000),round((3+((d*13+o*7)%90)/10.0)::numeric,4));
        end loop;
        for d in 1..14 loop
          insert into api_request_logs(org_id,api_key_id,method,path,status_code,latency_ms,model,ip,created_at)
          values (oid,akid,'POST',(array['/v1/chat/completions','/v1/embeddings','/v1/chat/completions','/v1/knowledge/search'])[1+(d%4)],
            (array[200,200,200,429,200,400,200,200])[1+(d%8)],180+((d*53+o*17)%900),models[1+(d%3)],'203.0.113.'||(10+d),now()-((d*95)||' minutes')::interval);
        end loop;
      end if;
    end loop;

    for i in 1..12 loop  -- audit log
      insert into audit_logs(org_id,actor_id,action,entity_type,entity_id,metadata,ip,created_at)
      values (oid,training.id('user:'||o||':'||(1+(i%6))),actions[1+(i%10)],split_part(actions[1+(i%10)],'.',1),
        training.id('proj:'||o||':'||(1+(i%4)))::text,jsonb_build_object('note','Synthetic event '||i),'10.'||(20+o)||'.0.'||(10+i),now()-((i*38)||' hours')::interval);
    end loop;

    for u in 1..6 loop  -- sessions
      insert into sessions(user_id,device,ip,user_agent,location,last_seen_at,created_at) values
       (training.id('user:'||o||':'||u),'MacBook Pro - Chrome','10.'||(20+o)||'.'||u||'.5','Mozilla/5.0 (Macintosh)','Muscat, OM',now()-((u)||' hours')::interval,now()-interval '9 days'),
       (training.id('user:'||o||':'||u),'iPhone - Safari','10.'||(20+o)||'.'||u||'.9','Mozilla/5.0 (iPhone)','Muscat, OM',now()-((u*5)||' hours')::interval,now()-interval '20 days');
    end loop;
  end loop;
end $$;

create or replace function training.reset() returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from auth.users where id in (select id from public.profiles where is_instructor = false);
  delete from public.organizations;
  delete from public.password_resets;
  delete from public.rate_limits;
  delete from public.training_progress;
  perform training.seed();
end $$;

revoke all on function training.seed(), training.reset() from public, anon, authenticated;
grant usage on schema training to service_role;
grant execute on function training.seed(), training.reset() to service_role;

-- thin public wrappers so the service role can call them over PostgREST
create or replace function public.training_reset() returns void language sql security definer set search_path = public as $$ select training.reset() $$;
revoke all on function public.training_reset() from public, anon, authenticated;
grant execute on function public.training_reset() to service_role;

select training.seed();
